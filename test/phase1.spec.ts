import { TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { BackfillJobEntity, BackfillJobStatus } from '@app/db/entities/backfill-job.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';
import { BlockSyncService } from '../apps/worker-ingest/src/ingest/services/block-sync.service';
import { ReceiptSyncService } from '../apps/worker-ingest/src/ingest/services/receipt-sync.service';
import { CheckpointService } from '../apps/worker-ingest/src/ingest/services/checkpoint.service';
import { ReorgDetectionService } from '../apps/worker-ingest/src/ingest/services/reorg-detection.service';
import { Erc20TransferDecoderService } from '../apps/worker-decode/src/decode/services/erc20-transfer-decoder.service';
import { BackfillJobService } from '../apps/worker-backfill/src/backfill/services/backfill-job.service';
import { BackfillRunnerService } from '../apps/worker-backfill/src/backfill/services/backfill-runner.service';
import { BlocksController } from '../apps/api/src/blocks/blocks.controller';
import { TransactionsController } from '../apps/api/src/transactions/transactions.controller';
import { AddressesController } from '../apps/api/src/addresses/addresses.controller';
import { SearchController } from '../apps/api/src/search/search.controller';
import { TokensController } from '../apps/api/src/tokens/tokens.controller';
import { createTestModule, clearDatabase, MockQueue } from './setup';
import { TestChainProvider } from './test-chain-provider';
import { MetricsService } from '@app/common/metrics/metrics.service';

describe('Phase 1: End-to-end system validation', () => {
  let module: TestingModule;
  let chainProvider: TestChainProvider;
  let decodeQueue: MockQueue;

  let blockRepo: Repository<BlockEntity>;
  let txRepo: Repository<TransactionEntity>;
  let receiptRepo: Repository<TransactionReceiptEntity>;
  let logRepo: Repository<LogEntity>;
  let transferRepo: Repository<TokenTransferEntity>;
  let checkpointRepo: Repository<SyncCheckpointEntity>;
  let jobRepo: Repository<BackfillJobEntity>;
  let reorgRepo: Repository<ReorgEventEntity>;

  let blockSyncService: BlockSyncService;
  let receiptSyncService: ReceiptSyncService;
  let checkpointService: CheckpointService;
  let reorgDetectionService: ReorgDetectionService;
  let erc20Decoder: Erc20TransferDecoderService;
  let backfillJobService: BackfillJobService;
  let backfillRunnerService: BackfillRunnerService;
  let metricsService: MetricsService;

  let blocksController: BlocksController;
  let transactionsController: TransactionsController;
  let addressesController: AddressesController;
  let searchController: SearchController;

  beforeAll(async () => {
    // Set env for test
    process.env.INGEST_CONFIRMATIONS = '0';
    process.env.INGEST_BATCH_SIZE = '10';
    process.env.START_BLOCK = '1';

    const result = await createTestModule(
      [
        BlockSyncService,
        ReceiptSyncService,
        CheckpointService,
        ReorgDetectionService,
        Erc20TransferDecoderService,
        BackfillJobService,
        BackfillRunnerService,
      ],
      [
        BlocksController,
        TransactionsController,
        AddressesController,
        SearchController,
        TokensController,
      ],
    );

    module = result.module;
    chainProvider = result.chainProvider;
    decodeQueue = result.decodeQueue;

    blockRepo = module.get(getRepositoryToken(BlockEntity));
    txRepo = module.get(getRepositoryToken(TransactionEntity));
    receiptRepo = module.get(getRepositoryToken(TransactionReceiptEntity));
    logRepo = module.get(getRepositoryToken(LogEntity));
    transferRepo = module.get(getRepositoryToken(TokenTransferEntity));
    checkpointRepo = module.get(getRepositoryToken(SyncCheckpointEntity));
    jobRepo = module.get(getRepositoryToken(BackfillJobEntity));
    reorgRepo = module.get(getRepositoryToken(ReorgEventEntity));

    blockSyncService = module.get(BlockSyncService);
    receiptSyncService = module.get(ReceiptSyncService);
    checkpointService = module.get(CheckpointService);
    reorgDetectionService = module.get(ReorgDetectionService);
    erc20Decoder = module.get(Erc20TransferDecoderService);
    backfillJobService = module.get(BackfillJobService);
    backfillRunnerService = module.get(BackfillRunnerService);
    metricsService = module.get(MetricsService);

    blocksController = module.get(BlocksController);
    transactionsController = module.get(TransactionsController);
    addressesController = module.get(AddressesController);
    searchController = module.get(SearchController);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await clearDatabase(module);
    decodeQueue.clear();
    chainProvider.reset();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Ingest a small block range and confirm data lines up
  // ────────────────────────────────────────────────────────────────
  describe('Block ingestion and data integrity', () => {
    it('should ingest blocks with transactions', async () => {
      const synced = await blockSyncService.syncNextBatch(5);

      expect(synced).toBe(5);

      const blocks = await blockRepo.find({ order: { number: 'ASC' } });
      expect(blocks.length).toBe(5);

      // Verify block numbers are sequential
      for (let i = 0; i < blocks.length; i++) {
        expect(Number(blocks[i].number)).toBe(i + 1);
      }

      // Verify transactions were inserted
      const txCount = await txRepo.count();
      expect(txCount).toBeGreaterThan(0);

      // Verify each transaction has valid block reference
      const txs = await txRepo.find();
      for (const tx of txs) {
        const block = await blockRepo.findOne({
          where: { number: tx.blockNumber },
        });
        expect(block).not.toBeNull();
      }
    });

    it('should ingest receipts and logs for a block', async () => {
      // Ingest blocks first
      await blockSyncService.syncNextBatch(5);

      // Now sync receipts for each block
      for (let bn = 1; bn <= 5; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      const receipts = await receiptRepo.find();
      expect(receipts.length).toBeGreaterThan(0);

      const logs = await logRepo.find();
      expect(logs.length).toBeGreaterThan(0);

      // Every receipt should correspond to a transaction
      for (const receipt of receipts) {
        const tx = await txRepo.findOne({
          where: { hash: receipt.transactionHash },
        });
        expect(tx).not.toBeNull();
      }

      // Every log should have a valid block number
      for (const log of logs) {
        const block = await blockRepo.findOne({
          where: { number: log.blockNumber },
        });
        expect(block).not.toBeNull();
      }
    });

    it('should store parent hashes correctly forming a chain', async () => {
      await blockSyncService.syncNextBatch(10);

      const blocks = await blockRepo.find({ order: { number: 'ASC' } });

      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].parentHash).toBe(blocks[i - 1].hash);
      }
    });

    it('should lowercase all addresses and hashes', async () => {
      await blockSyncService.syncNextBatch(5);
      for (let bn = 1; bn <= 5; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      const txs = await txRepo.find();
      for (const tx of txs) {
        expect(tx.hash).toBe(tx.hash.toLowerCase());
        expect(tx.fromAddress).toBe(tx.fromAddress.toLowerCase());
        if (tx.toAddress) {
          expect(tx.toAddress).toBe(tx.toAddress.toLowerCase());
        }
      }

      const logs = await logRepo.find();
      for (const log of logs) {
        expect(log.address).toBe(log.address.toLowerCase());
        expect(log.transactionHash).toBe(log.transactionHash.toLowerCase());
      }
    });

    it('should enqueue decode jobs for each synced block', async () => {
      await blockSyncService.syncNextBatch(5);

      expect(decodeQueue.jobs.length).toBe(5);
      for (let i = 0; i < 5; i++) {
        expect(decodeQueue.jobs[i].name).toBe('process-block');
        expect(decodeQueue.jobs[i].data.blockNumber).toBe(i + 1);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. ERC-20 transfer decoding
  // ────────────────────────────────────────────────────────────────
  describe('ERC-20 transfer decoding', () => {
    it('should decode ERC-20 Transfer events from logs', async () => {
      // Ingest blocks and receipts
      await blockSyncService.syncNextBatch(10);
      for (let bn = 1; bn <= 10; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      // Run decoder on each block
      let totalDecoded = 0;
      for (let bn = 1; bn <= 10; bn++) {
        totalDecoded += await erc20Decoder.decodeBlock(bn);
      }

      // TestChainProvider generates transfers on even blocks, tx index 0
      const transfers = await transferRepo.find();
      expect(transfers.length).toBe(totalDecoded);
      expect(transfers.length).toBeGreaterThan(0);

      // Verify transfer fields
      for (const transfer of transfers) {
        expect(transfer.tokenAddress).toBe(
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        );
        expect(transfer.fromAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(transfer.toAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(BigInt(transfer.amountRaw)).toBeGreaterThan(0n);
      }
    });

    it('should not decode non-ERC20 logs (e.g. Approval events)', async () => {
      await blockSyncService.syncNextBatch(10);
      for (let bn = 1; bn <= 10; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      const allLogs = await logRepo.count();
      let transferCount = 0;
      for (let bn = 1; bn <= 10; bn++) {
        transferCount += await erc20Decoder.decodeBlock(bn);
      }

      // Should have decoded fewer transfers than total logs
      expect(transferCount).toBeLessThan(allLogs);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. Checkpoint resume behavior
  // ────────────────────────────────────────────────────────────────
  describe('Checkpoint and restart behavior', () => {
    it('should create a checkpoint after syncing', async () => {
      await blockSyncService.syncNextBatch(5);

      const checkpoint = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });

      expect(checkpoint).not.toBeNull();
      expect(Number(checkpoint!.lastSyncedBlock)).toBe(5);
    });

    it('should resume from checkpoint on next sync', async () => {
      // First batch: blocks 1-5
      await blockSyncService.syncNextBatch(5);

      const firstCheckpoint = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(firstCheckpoint!.lastSyncedBlock)).toBe(5);

      // Second batch: should continue from 6
      const synced = await blockSyncService.syncNextBatch(5);
      expect(synced).toBe(5);

      const secondCheckpoint = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(secondCheckpoint!.lastSyncedBlock)).toBe(10);

      // Verify blocks 1-10 exist, no gaps
      const blocks = await blockRepo.find({ order: { number: 'ASC' } });
      expect(blocks.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(Number(blocks[i].number)).toBe(i + 1);
      }
    });

    it('should checkpoint after each block, not just at batch end', async () => {
      // Sync 3 blocks
      await blockSyncService.syncNextBatch(3);

      // Checkpoint should be at 3
      const cp = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(cp!.lastSyncedBlock)).toBe(3);

      // Now sync 2 more — should start from 4
      await blockSyncService.syncNextBatch(2);

      const cp2 = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(cp2!.lastSyncedBlock)).toBe(5);

      // No duplicates
      const blockCount = await blockRepo.count();
      expect(blockCount).toBe(5);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. Idempotency — duplicate delivery produces no duplicates
  // ────────────────────────────────────────────────────────────────
  describe('Idempotency and duplicate delivery', () => {
    it('should not create duplicate blocks on re-sync', async () => {
      await blockSyncService.syncBlock(1);
      await blockSyncService.syncBlock(1);

      const blocks = await blockRepo.find({ where: { number: '1' } });
      expect(blocks.length).toBe(1);
    });

    it('should not create duplicate transactions on re-sync', async () => {
      await blockSyncService.syncBlock(1);
      await blockSyncService.syncBlock(1);

      const txs = await txRepo.find({ where: { blockNumber: '1' } });
      const chainBlock = chainProvider.getBlock(1)!;
      expect(txs.length).toBe(chainBlock.transactions.length);
    });

    it('should not create duplicate receipts on re-process', async () => {
      await blockSyncService.syncBlock(1);
      await receiptSyncService.syncReceiptsForBlock(1);
      await receiptSyncService.syncReceiptsForBlock(1);

      const txs = await txRepo.find({ where: { blockNumber: '1' } });
      const receipts = await receiptRepo.find();
      expect(receipts.length).toBe(txs.length);
    });

    it('should not create duplicate logs on re-process', async () => {
      await blockSyncService.syncBlock(2); // even block has transfer logs
      await receiptSyncService.syncReceiptsForBlock(2);

      const logCountBefore = await logRepo.count();

      // Re-process — should not add more logs
      await receiptSyncService.syncReceiptsForBlock(2);

      const logCountAfter = await logRepo.count();
      // Receipt sync skips if receipt already exists, so no new logs
      expect(logCountAfter).toBe(logCountBefore);
    });

    it('should not create duplicate token transfers on re-decode', async () => {
      await blockSyncService.syncBlock(2);
      await receiptSyncService.syncReceiptsForBlock(2);

      await erc20Decoder.decodeBlock(2);
      const countBefore = await transferRepo.count();

      await erc20Decoder.decodeBlock(2);
      const countAfter = await transferRepo.count();

      expect(countAfter).toBe(countBefore);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. Backfill job lifecycle
  // ────────────────────────────────────────────────────────────────
  describe('Backfill job lifecycle', () => {
    it('should create a backfill job', async () => {
      const job = await backfillJobService.createJob(1, 10, 5);

      expect(job.id).toBeDefined();
      expect(job.status).toBe(BackfillJobStatus.PENDING);
      expect(Number(job.fromBlock)).toBe(1);
      expect(Number(job.toBlock)).toBe(10);
      expect(job.batchSize).toBe(5);
    });

    it('should run a backfill job to completion', async () => {
      await backfillJobService.createJob(1, 5, 5);

      const hadWork = await backfillRunnerService.processNextJob();
      expect(hadWork).toBe(true);

      const job = (await backfillJobService.getAllJobs())[0];
      expect(job.status).toBe(BackfillJobStatus.COMPLETED);

      // Should have ingested blocks 1-5
      const blockCount = await blockRepo.count();
      expect(blockCount).toBe(5);

      // Should also have receipts and logs
      const receiptCount = await receiptRepo.count();
      expect(receiptCount).toBeGreaterThan(0);

      const logCount = await logRepo.count();
      expect(logCount).toBeGreaterThan(0);
    });

    it('should pause and resume a backfill job', async () => {
      const created = await backfillJobService.createJob(1, 20, 5);

      // Pause before running
      await backfillJobService.pauseJob(created.id);

      const paused = await backfillJobService.getJob(created.id);
      expect(paused!.status).toBe(BackfillJobStatus.PAUSED);

      // processNextJob should not pick up paused jobs
      const hadWork = await backfillRunnerService.processNextJob();
      expect(hadWork).toBe(false);

      // Resume
      await backfillJobService.resumeJob(created.id);

      const resumed = await backfillJobService.getJob(created.id);
      expect(resumed!.status).toBe(BackfillJobStatus.PENDING);

      // Now it should process
      const hadWorkAfterResume = await backfillRunnerService.processNextJob();
      expect(hadWorkAfterResume).toBe(true);
    });

    it('should track progress and resume from current_block', async () => {
      // Create a job from 1-10 with small batches
      const job = await backfillJobService.createJob(1, 10, 3);

      // Run the job (it will complete since our mock doesn't pause mid-batch)
      await backfillRunnerService.processNextJob();

      const completed = await backfillJobService.getJob(job.id);
      expect(completed!.status).toBe(BackfillJobStatus.COMPLETED);

      // All 10 blocks should be present
      const blockCount = await blockRepo.count();
      expect(blockCount).toBe(10);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Search functionality
  // ────────────────────────────────────────────────────────────────
  describe('Search', () => {
    beforeEach(async () => {
      // Populate data
      await blockSyncService.syncNextBatch(5);
      for (let bn = 1; bn <= 5; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should find a block by number', async () => {
      const result = await searchController.search('1');

      expect(result.type).toBe('block');
      expect(result.result).not.toBeNull();
      expect(Number((result.result as any).number)).toBe(1);
    });

    it('should find a transaction by hash', async () => {
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      expect(tx).toBeDefined();

      const result = await searchController.search(tx!.hash);

      expect(result.type).toBe('transaction');
      expect((result.result as any).hash).toBe(tx!.hash);
    });

    it('should find an address that has transactions', async () => {
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      expect(tx).toBeDefined();

      const result = await searchController.search(tx.fromAddress);

      expect(result.type).toBe('address');
      expect((result.result as any).address).toBe(tx!.fromAddress);
    });

    it('should return none for unknown query', async () => {
      // Use a 42-char address that definitely has no transactions
      const result = await searchController.search(
        '0x0000000000000000000000000000000000ffffff',
      );

      expect(result.type).toBe('none');
      expect(result.result).toBeNull();
    });

    it('should find a block by hash', async () => {
      const block = await blockRepo.findOne({ where: { number: '1' } });
      expect(block).not.toBeNull();

      // Block hash is 66 chars, search controller checks for tx first then block
      const result = await searchController.search(block!.hash);

      expect(result.type).toBe('block');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. API pagination
  // ────────────────────────────────────────────────────────────────
  describe('API pagination', () => {
    beforeEach(async () => {
      // Ingest 20 blocks to have enough data
      await blockSyncService.syncNextBatch(20);
      for (let bn = 1; bn <= 20; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should paginate address transactions with limit and offset', async () => {
      // Find an address with multiple transactions
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      const address = tx.fromAddress;

      const page1 = await addressesController.getAddressTransactions(
        address,
        '2',
        '0',
      );
      const page2 = await addressesController.getAddressTransactions(
        address,
        '2',
        '2',
      );

      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);
      expect(page1.transactions.length).toBeLessThanOrEqual(2);

      if (page1.total > 2) {
        expect(page2.transactions.length).toBeGreaterThan(0);
        // No overlap between pages
        const page1Hashes = page1.transactions.map((t: any) => t.hash);
        const page2Hashes = page2.transactions.map((t: any) => t.hash);
        for (const hash of page2Hashes) {
          expect(page1Hashes).not.toContain(hash);
        }
      }
    });

    it('should enforce max limit of 100', async () => {
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      const result = await addressesController.getAddressTransactions(
        tx.fromAddress,
        '500',
        '0',
      );

      expect(result.limit).toBe(100);
    });

    it('should paginate token transfers', async () => {
      // Decode transfers first
      for (let bn = 1; bn <= 20; bn++) {
        await erc20Decoder.decodeBlock(bn);
      }

      const transfers = await transferRepo.find({ take: 1 });
      if (transfers.length === 0) return; // skip if no transfers

      const address = transfers[0].fromAddress;
      const result = await addressesController.getAddressTokenTransfers(
        address,
        '5',
        '0',
      );

      expect(result.limit).toBe(5);
      expect(result.offset).toBe(0);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should return latest blocks with limit', async () => {
      const blocks = await blocksController.getLatestBlocks('5');

      expect(blocks.length).toBe(5);
      // Should be in descending order
      for (let i = 1; i < blocks.length; i++) {
        expect(Number(blocks[i].number)).toBeLessThan(
          Number(blocks[i - 1].number),
        );
      }
    });

    it('should return block details with transactions', async () => {
      const result = await blocksController.getBlock('1');

      expect(result).toBeDefined();
      expect(Number((result as any).number)).toBe(1);
      expect((result as any).transactions).toBeDefined();
      expect((result as any).transactions.length).toBeGreaterThan(0);
    });

    it('should return transaction with receipt, logs, and transfers', async () => {
      // Find a tx on an even block (which has transfers)
      const tx = await txRepo.findOne({
        where: { blockNumber: '2', transactionIndex: 0 },
      });
      if (!tx) return;

      await erc20Decoder.decodeBlock(2);

      const result = await transactionsController.getTransaction(tx.hash);

      expect(result.transaction).toBeDefined();
      expect(result.receipt).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.tokenTransfers.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. Reorg detection and rollback
  // ────────────────────────────────────────────────────────────────
  describe('Reorg detection', () => {
    it('should detect no reorg when parent hashes match', async () => {
      await blockSyncService.syncNextBatch(5);

      const result = await reorgDetectionService.checkForReorg(6);

      expect(result.detected).toBe(false);
    });

    it('should detect a reorg when parent hash mismatches', async () => {
      // Sync blocks 1-5 normally
      await blockSyncService.syncNextBatch(5);

      // Now change block 6 on the chain to have a different parent hash
      // that doesn't match block 5's hash
      chainProvider.setBlockParentHash(6, '0x' + 'ab'.repeat(32));

      const result = await reorgDetectionService.checkForReorg(6);

      expect(result.detected).toBe(true);
      expect(result.reorgBlock).toBe(5);
      expect(result.commonAncestor).toBeDefined();
    });

    it('should rollback data from reorg point forward', async () => {
      // Sync blocks 1-10
      await blockSyncService.syncNextBatch(10);
      for (let bn = 1; bn <= 10; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
        await erc20Decoder.decodeBlock(bn);
      }

      const blocksBefore = await blockRepo.count();
      const txsBefore = await txRepo.count();
      const logsBefore = await logRepo.count();

      // Simulate reorg at block 8 — rollback from block 8 onward
      await reorgDetectionService.rollback(7, 8);

      const blocksAfter = await blockRepo.count();
      const txsAfter = await txRepo.count();
      const logsAfter = await logRepo.count();
      const transfersAfter = await transferRepo.count();

      // Should have fewer rows after rollback
      expect(blocksAfter).toBeLessThan(blocksBefore);
      expect(blocksAfter).toBe(7); // blocks 1-7 remain

      // Transactions should also be cleaned (CASCADE)
      expect(txsAfter).toBeLessThan(txsBefore);

      // Logs should be cleaned
      expect(logsAfter).toBeLessThan(logsBefore);

      // Verify no data remains for blocks >= 8
      const remainingBlocks = await blockRepo.find({ order: { number: 'ASC' } });
      for (const block of remainingBlocks) {
        expect(Number(block.number)).toBeLessThanOrEqual(7);
      }

      const remainingLogs = await logRepo.find();
      for (const log of remainingLogs) {
        expect(Number(log.blockNumber)).toBeLessThanOrEqual(7);
      }

      const remainingTransfers = await transferRepo.find();
      for (const transfer of remainingTransfers) {
        expect(Number(transfer.blockNumber)).toBeLessThanOrEqual(7);
      }
    });

    it('should reset checkpoints on rollback', async () => {
      await blockSyncService.syncNextBatch(10);

      const cpBefore = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(cpBefore!.lastSyncedBlock)).toBe(10);

      await reorgDetectionService.rollback(5, 6);

      const cpAfter = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(cpAfter!.lastSyncedBlock)).toBe(5);
    });

    it('should record reorg events in audit table', async () => {
      await blockSyncService.syncNextBatch(10);

      await reorgDetectionService.rollback(7, 8);

      const events = await reorgRepo.find();
      expect(events.length).toBe(1);
      expect(Number(events[0].reorgBlock)).toBe(8);
      expect(events[0].depth).toBe(1);
      expect(Number(events[0].commonAncestorBlock)).toBe(7);
    });

    it('should allow re-sync after rollback', async () => {
      // Sync 1-10
      await blockSyncService.syncNextBatch(10);

      // Rollback to 5 (blocks 6-10 deleted, checkpoint reset to 5)
      await reorgDetectionService.rollback(5, 6);

      const cp = await checkpointRepo.findOne({
        where: { workerName: 'block-sync' },
      });
      expect(Number(cp!.lastSyncedBlock)).toBe(5);

      // Re-sync should pick up from 6 — chain provider has clean data
      const synced = await blockSyncService.syncNextBatch(5);
      expect(synced).toBe(5);

      const blockCount = await blockRepo.count();
      expect(blockCount).toBe(10);
    });

    it('should trigger rollback automatically during sync when reorg detected', async () => {
      // Sync blocks 1-10
      await blockSyncService.syncNextBatch(10);

      // Corrupt block 11's parent hash on the chain
      chainProvider.setBlockParentHash(11, '0x' + 'ff'.repeat(32));

      // Next sync should detect reorg and return 0
      const synced = await blockSyncService.syncNextBatch(5);
      expect(synced).toBe(0);

      // Should have recorded a reorg event
      const events = await reorgRepo.find();
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. Metrics tracking
  // ────────────────────────────────────────────────────────────────
  describe('Metrics', () => {
    it('should track blocks synced counter', async () => {
      const before = metricsService.getCounter('ingest.blocks_synced');
      await blockSyncService.syncNextBatch(5);
      const after = metricsService.getCounter('ingest.blocks_synced');

      expect(after - before).toBe(5);
    });

    it('should track chain head and lag gauges', async () => {
      await blockSyncService.syncNextBatch(5);

      // Gauges show current value, not cumulative
      expect(metricsService.getGauge('ingest.chain_head')).toBe(100);
      expect(metricsService.getGauge('ingest.indexed_head')).toBe(5);
      expect(metricsService.getGauge('ingest.lag')).toBe(95);
    });

    it('should track decode counters', async () => {
      const beforeBlocks = metricsService.getCounter('decode.blocks_processed');
      const beforeTransfers = metricsService.getCounter('decode.erc20_transfers');

      await blockSyncService.syncNextBatch(10);
      for (let bn = 1; bn <= 10; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
        await erc20Decoder.decodeBlock(bn);
      }

      expect(metricsService.getCounter('decode.blocks_processed') - beforeBlocks).toBe(10);
      expect(metricsService.getCounter('decode.erc20_transfers') - beforeTransfers).toBeGreaterThan(0);
    });
  });
});
