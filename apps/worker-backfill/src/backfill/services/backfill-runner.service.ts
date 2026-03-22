import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainProvider, CHAIN_PROVIDER } from '@app/chain-provider';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { BackfillJobEntity, BackfillJobStatus } from '@app/db/entities/backfill-job.entity';
import { BackfillJobService } from './backfill-job.service';
import { normalizeAddress, normalizeHash, MetricsService } from '@app/common';
import { withRetry } from '@app/common/utils/retry';
import { ERC20_TRANSFER_TOPIC } from '@app/abi';
import { topicToAddress } from '@app/common';

@Injectable()
export class BackfillRunnerService {
  private readonly logger = new Logger(BackfillRunnerService.name);
  private running = false;

  constructor(
    @Inject(CHAIN_PROVIDER)
    private readonly chainProvider: ChainProvider,

    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TransactionReceiptEntity)
    private readonly receiptRepo: Repository<TransactionReceiptEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    private readonly jobService: BackfillJobService,

    private readonly metrics: MetricsService,
  ) {}

  async processNextJob(): Promise<boolean> {
    if (this.running) return false;

    const jobs = await this.jobService.getActiveJobs();
    if (jobs.length === 0) return false;

    const job = jobs[0];
    this.running = true;

    try {
      await this.runJob(job);
      return true;
    } catch (error) {
      await this.jobService.markFailed(job.id, (error as Error).message);
      return false;
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: BackfillJobEntity): Promise<void> {
    const fromBlock = Number(job.currentBlock);
    const toBlock = Number(job.toBlock);
    const batchSize = job.batchSize;

    this.logger.log(
      `Starting backfill job #${job.id}: ${fromBlock} -> ${toBlock} (batch=${batchSize})`,
    );

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      // Check if job was paused
      const currentJob = await this.jobService.getJob(job.id);
      if (!currentJob || currentJob.status === BackfillJobStatus.PAUSED) {
        this.logger.log(`Job #${job.id} paused at block ${start}`);
        return;
      }

      const end = Math.min(start + batchSize - 1, toBlock);

      for (let blockNumber = start; blockNumber <= end; blockNumber++) {
        await this.syncFullBlock(blockNumber);
      }

      await this.jobService.updateProgress(job.id, end);

      const blocksInBatch = end - start + 1;
      this.metrics.increment('backfill.blocks_synced', blocksInBatch);
      this.metrics.recordRate('backfill.blocks', blocksInBatch);
      this.metrics.setGauge('backfill.current_block', end);

      const totalBlocks = toBlock - Number(job.fromBlock);
      const doneBlocks = end - Number(job.fromBlock);
      const pct = totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 100;
      this.metrics.setGauge('backfill.progress_pct', pct);

      this.logger.debug(`Job #${job.id}: synced through block ${end} (${pct}%)`);
    }

    await this.jobService.markCompleted(job.id);
  }

  private async syncFullBlock(blockNumber: number): Promise<void> {
    const block = await withRetry(() =>
      this.chainProvider.getBlockWithTransactions(blockNumber),
    );
    if (!block) return;

    // Insert block
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

    // Insert transactions
    if (block.transactions.length > 0) {
      await this.txRepo.upsert(
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
        ['hash'],
      );

      // Fetch and store receipts + logs
      for (const tx of block.transactions) {
        const receipt = await withRetry(() =>
          this.chainProvider.getTransactionReceipt(tx.hash),
        );
        if (!receipt) continue;

        await this.receiptRepo.upsert(
          {
            transactionHash: normalizeHash(receipt.transactionHash),
            blockNumber: String(receipt.blockNumber),
            fromAddress: normalizeAddress(receipt.from),
            toAddress: receipt.to ? normalizeAddress(receipt.to) : null,
            contractAddress: receipt.contractAddress
              ? normalizeAddress(receipt.contractAddress)
              : null,
            gasUsed: receipt.gasUsed,
            cumulativeGasUsed: receipt.cumulativeGasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice ?? null,
            status: receipt.status,
          },
          ['transactionHash'],
        );

        if (receipt.logs.length > 0) {
          await this.logRepo
            .createQueryBuilder()
            .insert()
            .into(LogEntity)
            .values(
              receipt.logs.map((log) => ({
                blockNumber: String(log.blockNumber),
                transactionHash: normalizeHash(log.transactionHash),
                transactionIndex: log.transactionIndex,
                logIndex: log.logIndex,
                address: normalizeAddress(log.address),
                topic0: log.topics[0]?.toLowerCase() ?? null,
                topic1: log.topics[1]?.toLowerCase() ?? null,
                topic2: log.topics[2]?.toLowerCase() ?? null,
                topic3: log.topics[3]?.toLowerCase() ?? null,
                data: log.data,
                removed: log.removed,
              })),
            )
            .orIgnore()
            .execute();

          // Decode ERC-20 transfers inline from the receipt logs
          const transferInserts: Partial<TokenTransferEntity>[] = [];
          for (const log of receipt.logs) {
            const topic0 = log.topics[0]?.toLowerCase() ?? null;
            const topic1 = log.topics[1]?.toLowerCase() ?? null;
            const topic2 = log.topics[2]?.toLowerCase() ?? null;
            const topic3 = log.topics[3]?.toLowerCase() ?? null;

            // ERC-20 Transfer: 3 topics (topic0 + 2 indexed), value in data
            if (topic0 === ERC20_TRANSFER_TOPIC && topic1 && topic2 && !topic3) {
              try {
                transferInserts.push({
                  transactionHash: normalizeHash(log.transactionHash),
                  blockNumber: String(log.blockNumber),
                  logIndex: log.logIndex,
                  tokenAddress: normalizeAddress(log.address),
                  fromAddress: topicToAddress(topic1),
                  toAddress: topicToAddress(topic2),
                  amountRaw: BigInt(log.data).toString(),
                });
              } catch {
                // Skip logs with unparseable data
              }
            }
          }

          if (transferInserts.length > 0) {
            await this.transferRepo
              .createQueryBuilder()
              .insert()
              .into(TokenTransferEntity)
              .values(transferInserts)
              .orIgnore()
              .execute();
          }
        }
      }
    }
  }
}
