import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { ChainProvider, CHAIN_PROVIDER } from '@app/chain-provider';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { QUEUE_NAMES } from '@app/queue';
import { normalizeAddress, normalizeHash, MetricsService } from '@app/common';
import { PartitionManagerService } from '@app/db/services/partition-manager.service';
import { ReorgDetectionService } from './reorg-detection.service';

@Injectable()
export class BlockSyncService {
  private readonly logger = new Logger(BlockSyncService.name);
  private readonly workerName = 'block-sync';

  constructor(
    @Inject(CHAIN_PROVIDER)
    private readonly chainProvider: ChainProvider,

    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(SyncCheckpointEntity)
    private readonly checkpointRepo: Repository<SyncCheckpointEntity>,

    @InjectQueue(QUEUE_NAMES.DECODE_LOGS)
    private readonly decodeQueue: Queue,

    private readonly metrics: MetricsService,

    private readonly reorgDetection: ReorgDetectionService,

    private readonly partitionManager: PartitionManagerService,
  ) {}

  async syncNextBatch(batchSize?: number): Promise<number> {
    const size = batchSize ?? Number(process.env.INGEST_BATCH_SIZE ?? 10);
    const checkpoint = await this.getOrCreateCheckpoint();
    const latestBlock = await this.chainProvider.getLatestBlockNumber();

    const confirmations = Number(process.env.INGEST_CONFIRMATIONS ?? 6);
    const targetBlock = latestBlock - confirmations;

    const nextBlock = Number(checkpoint.lastSyncedBlock) + 1;
    const endBlock = Math.min(nextBlock + size - 1, targetBlock);

    // Ensure partitions exist for the block range we're about to sync
    await this.partitionManager.ensurePartitionsForBlock(nextBlock);

    // Track chain head and lag
    this.metrics.setGauge('ingest.chain_head', latestBlock);
    this.metrics.setGauge('ingest.indexed_head', Number(checkpoint.lastSyncedBlock));
    this.metrics.setGauge('ingest.lag', latestBlock - Number(checkpoint.lastSyncedBlock));

    if (nextBlock > endBlock) {
      this.logger.debug('No new finalized blocks to sync');
      return 0;
    }

    // Check for reorg before syncing
    const reorgResult = await this.reorgDetection.checkForReorg(nextBlock);
    if (reorgResult.detected && reorgResult.commonAncestor !== undefined) {
      this.logger.warn(
        `Handling reorg: rolling back to common ancestor ${reorgResult.commonAncestor}`,
      );
      await this.reorgDetection.rollback(
        reorgResult.commonAncestor,
        reorgResult.reorgBlock!,
      );
      // After rollback, checkpoint is reset — re-read and start over
      return 0;
    }

    let synced = 0;

    for (let blockNumber = nextBlock; blockNumber <= endBlock; blockNumber++) {
      await this.syncBlock(blockNumber);

      checkpoint.lastSyncedBlock = String(blockNumber);
      checkpoint.updatedAt = new Date();
      await this.checkpointRepo.save(checkpoint);

      synced++;
    }

    this.metrics.increment('ingest.blocks_synced', synced);
    this.metrics.recordRate('ingest.blocks', synced);
    this.metrics.setGauge('ingest.indexed_head', endBlock);
    this.metrics.setGauge('ingest.lag', latestBlock - endBlock);

    this.logger.log(`Synced ${synced} blocks (${nextBlock} -> ${endBlock})`);
    return synced;
  }

  async syncBlock(blockNumber: number): Promise<void> {
    const block = await this.chainProvider.getBlockWithTransactions(blockNumber);
    if (!block) {
      this.logger.warn(`Block ${blockNumber} not found`);
      return;
    }

    await this.blockRepo.upsert(
      {
        number: String(block.number),
        hash: normalizeHash(block.hash),
        parentHash: normalizeHash(block.parentHash),
        timestamp: new Date(block.timestamp * 1000),
        gasLimit: block.gasLimit,
        gasUsed: block.gasUsed,
        baseFeePerGas: block.baseFeePerGas ?? null,
        miner: block.miner ? normalizeAddress(block.miner) : null,
      },
      ['number'],
    );

    if (block.transactions.length > 0) {
      await this.txRepo
        .createQueryBuilder()
        .insert()
        .into(TransactionEntity)
        .values(
          block.transactions.map((tx) => ({
            hash: normalizeHash(tx.hash),
            blockNumber: String(tx.blockNumber),
            transactionIndex: tx.transactionIndex,
            fromAddress: normalizeAddress(tx.from),
            toAddress: tx.to ? normalizeAddress(tx.to) : null,
            value: tx.value,
            inputData: tx.input,
            nonce: String(tx.nonce),
            gas: tx.gas,
            gasPrice: tx.gasPrice ?? null,
            maxFeePerGas: tx.maxFeePerGas ?? null,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
            type: tx.type ?? null,
          })),
        )
        .orIgnore()
        .execute();
    }

    // Enqueue receipt/log processing for this block
    await this.decodeQueue.add('process-block', { blockNumber }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.debug(
      `Block ${blockNumber}: ${block.transactions.length} txs`,
    );
  }

  private async getOrCreateCheckpoint(): Promise<SyncCheckpointEntity> {
    let checkpoint = await this.checkpointRepo.findOne({
      where: { workerName: this.workerName },
    });

    if (!checkpoint) {
      const startBlock = Number(process.env.START_BLOCK ?? 0);
      checkpoint = this.checkpointRepo.create({
        workerName: this.workerName,
        lastSyncedBlock: String(startBlock > 0 ? startBlock - 1 : 0),
        updatedAt: new Date(),
      });
      checkpoint = await this.checkpointRepo.save(checkpoint);
    }

    return checkpoint;
  }
}
