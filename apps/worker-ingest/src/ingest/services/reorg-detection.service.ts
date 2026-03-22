import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ChainProvider, CHAIN_PROVIDER } from '@app/chain-provider';
import { BlockEntity } from '@app/db/entities/block.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';
import { MetricsService, normalizeHash } from '@app/common';

const MAX_REORG_DEPTH = 128;

export interface ReorgResult {
  detected: boolean;
  reorgBlock?: number;
  depth?: number;
  commonAncestor?: number;
}

@Injectable()
export class ReorgDetectionService {
  private readonly logger = new Logger(ReorgDetectionService.name);

  constructor(
    @Inject(CHAIN_PROVIDER)
    private readonly chainProvider: ChainProvider,

    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(NftTransferEntity)
    private readonly nftTransferRepo: Repository<NftTransferEntity>,

    @InjectRepository(Erc721OwnershipEntity)
    private readonly erc721Repo: Repository<Erc721OwnershipEntity>,

    @InjectRepository(Erc1155BalanceEntity)
    private readonly erc1155Repo: Repository<Erc1155BalanceEntity>,

    @InjectRepository(SyncCheckpointEntity)
    private readonly checkpointRepo: Repository<SyncCheckpointEntity>,

    @InjectRepository(ReorgEventEntity)
    private readonly reorgRepo: Repository<ReorgEventEntity>,

    private readonly metrics: MetricsService,
  ) {}

  /**
   * Check if the next block to sync has a parent hash that matches
   * the hash we have stored for the previous block. If not, a reorg
   * has occurred and we need to find the common ancestor and rollback.
   */
  async checkForReorg(blockNumber: number): Promise<ReorgResult> {
    if (blockNumber <= 0) {
      return { detected: false };
    }

    const previousBlockNumber = blockNumber - 1;

    // Get our stored block
    const storedBlock = await this.blockRepo.findOne({
      where: { number: String(previousBlockNumber) },
    });

    if (!storedBlock) {
      // We don't have the previous block — can't check
      return { detected: false };
    }

    // Get the chain's version of the next block
    const chainBlock = await this.chainProvider.getBlockByNumber(blockNumber);
    if (!chainBlock) {
      return { detected: false };
    }

    const chainParentHash = normalizeHash(chainBlock.parentHash);
    const storedHash = normalizeHash(storedBlock.hash);

    if (chainParentHash === storedHash) {
      // No reorg — parent hash matches
      return { detected: false };
    }

    // Reorg detected — find common ancestor
    this.logger.warn(
      `Reorg detected at block ${blockNumber}: ` +
        `expected parent ${storedHash}, got ${chainParentHash}`,
    );

    const commonAncestor = await this.findCommonAncestor(previousBlockNumber);

    const depth = previousBlockNumber - commonAncestor;

    this.logger.warn(
      `Reorg depth: ${depth} blocks. Common ancestor: ${commonAncestor}`,
    );

    return {
      detected: true,
      reorgBlock: previousBlockNumber,
      depth,
      commonAncestor,
    };
  }

  /**
   * Walk backwards from the given block until we find a block whose
   * hash matches what the chain currently reports.
   */
  private async findCommonAncestor(fromBlock: number): Promise<number> {
    for (let bn = fromBlock; bn >= Math.max(0, fromBlock - MAX_REORG_DEPTH); bn--) {
      const storedBlock = await this.blockRepo.findOne({
        where: { number: String(bn) },
      });

      if (!storedBlock) {
        // No stored block — this is our boundary
        return bn;
      }

      const chainBlock = await this.chainProvider.getBlockByNumber(bn);
      if (!chainBlock) {
        return bn;
      }

      if (normalizeHash(storedBlock.hash) === normalizeHash(chainBlock.hash)) {
        return bn;
      }
    }

    // Exceeded max depth — log critical error
    this.logger.error(
      `Reorg exceeds max depth of ${MAX_REORG_DEPTH} blocks from ${fromBlock}. Manual intervention required.`,
    );

    return Math.max(0, fromBlock - MAX_REORG_DEPTH);
  }

  /**
   * Roll back all data from the reorg point forward and reset checkpoints.
   * CASCADE DELETE on blocks will handle transactions and receipts.
   * Logs and token_transfers need explicit cleanup by block_number.
   */
  async rollback(commonAncestor: number, reorgBlock: number): Promise<void> {
    const rollbackFrom = commonAncestor + 1;

    this.logger.warn(
      `Rolling back blocks ${rollbackFrom} through latest indexed`,
    );

    // Get the stored hash before we delete it (for audit)
    const oldBlock = await this.blockRepo.findOne({
      where: { number: String(reorgBlock) },
    });

    const chainBlock = await this.chainProvider.getBlockByNumber(reorgBlock);

    // Delete orphaned logs (not covered by CASCADE since logs don't FK to blocks)
    await this.logRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :from', { from: String(rollbackFrom) })
      .execute();

    // Delete orphaned token_transfers
    await this.transferRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :from', { from: String(rollbackFrom) })
      .execute();

    // Delete orphaned nft_transfers and recompute ownership
    // First, delete ownership/balance rows that were last updated in rolled-back blocks
    await this.erc721Repo
      .createQueryBuilder()
      .delete()
      .where('"last_transfer_block" >= :from', { from: String(rollbackFrom) })
      .execute();

    await this.erc1155Repo
      .createQueryBuilder()
      .delete()
      .where('"last_transfer_block" >= :from', { from: String(rollbackFrom) })
      .execute();

    // Delete nft_transfers for rolled-back blocks
    await this.nftTransferRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :from', { from: String(rollbackFrom) })
      .execute();

    // Delete blocks (CASCADE will handle transactions + receipts)
    await this.blockRepo
      .createQueryBuilder()
      .delete()
      .where('"number" >= :from', { from: String(rollbackFrom) })
      .execute();

    // Reset sync checkpoints to common ancestor
    const checkpoints = await this.checkpointRepo.find();
    for (const cp of checkpoints) {
      if (Number(cp.lastSyncedBlock) >= rollbackFrom) {
        cp.lastSyncedBlock = String(commonAncestor);
        cp.updatedAt = new Date();
        await this.checkpointRepo.save(cp);
      }
    }

    // Record reorg event
    const depth = reorgBlock - commonAncestor;
    await this.reorgRepo.save({
      reorgBlock: String(reorgBlock),
      depth,
      oldHash: oldBlock?.hash ?? 'unknown',
      newHash: chainBlock ? normalizeHash(chainBlock.hash) : 'unknown',
      commonAncestorBlock: String(commonAncestor),
    });

    this.metrics.increment('reorg.count');
    this.metrics.setGauge('reorg.last_depth', depth);

    this.logger.warn(
      `Rollback complete. Cleared blocks >= ${rollbackFrom}. ` +
        `Checkpoints reset to ${commonAncestor}.`,
    );
  }
}
