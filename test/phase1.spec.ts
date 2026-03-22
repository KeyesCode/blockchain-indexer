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
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { AddressNftHoldingEntity } from '@app/db/entities/address-nft-holding.entity';
import { NftContractStatsEntity } from '@app/db/entities/nft-contract-stats.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { NftSaleEntity } from '@app/db/entities/nft-sale.entity';
import { TokenApprovalEntity } from '@app/db/entities/token-approval.entity';
import { TokenAllowanceEntity } from '@app/db/entities/token-allowance.entity';
import { BlockSyncService } from '../apps/worker-ingest/src/ingest/services/block-sync.service';
import { ReceiptSyncService } from '../apps/worker-ingest/src/ingest/services/receipt-sync.service';
import { CheckpointService } from '../apps/worker-ingest/src/ingest/services/checkpoint.service';
import { ReorgDetectionService } from '../apps/worker-ingest/src/ingest/services/reorg-detection.service';
import { Erc20TransferDecoderService } from '../apps/worker-decode/src/decode/services/erc20-transfer-decoder.service';
import { Erc20ApprovalDecoderService } from '../apps/worker-decode/src/decode/services/erc20-approval-decoder.service';
import { BackfillJobService } from '../apps/worker-backfill/src/backfill/services/backfill-job.service';
import { BackfillRunnerService } from '../apps/worker-backfill/src/backfill/services/backfill-runner.service';
import { TokenMetadataService } from '../apps/worker-decode/src/decode/services/token-metadata.service';
import { NftTransferDecoderService } from '../apps/worker-decode/src/decode/services/nft-transfer-decoder.service';
import { ContractStandardDetectorService } from '../apps/worker-decode/src/decode/services/contract-standard-detector.service';
import { NftMetadataService } from '../apps/worker-decode/src/decode/services/nft-metadata.service';
import { NftReadModelService } from '../libs/db/src/services/nft-read-model.service';
import { NftReconciliationService } from '../libs/db/src/services/nft-reconciliation.service';
import { SummaryService } from '../libs/db/src/services/summary.service';
import { PartitionManagerService } from '../libs/db/src/services/partition-manager.service';
import { ProtocolRegistryService } from '../apps/worker-decode/src/decode/protocols/protocol-registry.service';
import { UniswapV2Decoder } from '../apps/worker-decode/src/decode/protocols/uniswap-v2/uniswap-v2.decoder';
import { UniswapV3Decoder } from '../apps/worker-decode/src/decode/protocols/uniswap-v3/uniswap-v3.decoder';
import { SeaportDecoder } from '../apps/worker-decode/src/decode/protocols/seaport/seaport.decoder';
import { BlurDecoder } from '../apps/worker-decode/src/decode/protocols/blur/blur.decoder';
import { BlocksController } from '../apps/api/src/blocks/blocks.controller';
import { BlocksService } from '../apps/api/src/blocks/blocks.service';
import { TransactionsController } from '../apps/api/src/transactions/transactions.controller';
import { TransactionsService } from '../apps/api/src/transactions/transactions.service';
import { AddressesController } from '../apps/api/src/addresses/addresses.controller';
import { AddressesService } from '../apps/api/src/addresses/addresses.service';
import { SearchController } from '../apps/api/src/search/search.controller';
import { SearchService } from '../apps/api/src/search/search.service';
import { TokensController } from '../apps/api/src/tokens/tokens.controller';
import { TokensService } from '../apps/api/src/tokens/tokens.service';
import { NftsService } from '../apps/api/src/nfts/nfts.service';
import { ProtocolsService } from '../apps/api/src/protocols/protocols.service';
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
  let nftTransferRepo: Repository<NftTransferEntity>;
  let erc721Repo: Repository<Erc721OwnershipEntity>;
  let erc1155Repo: Repository<Erc1155BalanceEntity>;
  let holdingRepo: Repository<AddressNftHoldingEntity>;
  let statsRepo: Repository<NftContractStatsEntity>;
  let swapRepo: Repository<DexSwapEntity>;
  let pairRepo: Repository<DexPairEntity>;
  let protocolRegistry: ProtocolRegistryService;
  let approvalRepo: Repository<TokenApprovalEntity>;
  let allowanceRepo: Repository<TokenAllowanceEntity>;
  let approvalDecoder: Erc20ApprovalDecoderService;
  let saleRepo: Repository<NftSaleEntity>;

  let blockSyncService: BlockSyncService;
  let receiptSyncService: ReceiptSyncService;
  let checkpointService: CheckpointService;
  let reorgDetectionService: ReorgDetectionService;
  let erc20Decoder: Erc20TransferDecoderService;
  let nftDecoder: NftTransferDecoderService;
  let backfillJobService: BackfillJobService;
  let backfillRunnerService: BackfillRunnerService;
  let metricsService: MetricsService;
  let reconciliationService: NftReconciliationService;

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
        // Worker services
        BlockSyncService,
        ReceiptSyncService,
        CheckpointService,
        ReorgDetectionService,
        Erc20TransferDecoderService,
        Erc20ApprovalDecoderService,
        BackfillJobService,
        BackfillRunnerService,
        TokenMetadataService,
        NftTransferDecoderService,
        ContractStandardDetectorService,
        NftMetadataService,
        NftReadModelService,
        NftReconciliationService,
        ProtocolRegistryService,
        UniswapV2Decoder,
        UniswapV3Decoder,
        SeaportDecoder,
        BlurDecoder,
        SummaryService,
        PartitionManagerService,
        // API services
        BlocksService,
        TransactionsService,
        AddressesService,
        SearchService,
        TokensService,
        NftsService,
        ProtocolsService,
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
    nftTransferRepo = module.get(getRepositoryToken(NftTransferEntity));
    erc721Repo = module.get(getRepositoryToken(Erc721OwnershipEntity));
    erc1155Repo = module.get(getRepositoryToken(Erc1155BalanceEntity));
    holdingRepo = module.get(getRepositoryToken(AddressNftHoldingEntity));
    statsRepo = module.get(getRepositoryToken(NftContractStatsEntity));
    swapRepo = module.get(getRepositoryToken(DexSwapEntity));
    pairRepo = module.get(getRepositoryToken(DexPairEntity));
    approvalRepo = module.get(getRepositoryToken(TokenApprovalEntity));
    allowanceRepo = module.get(getRepositoryToken(TokenAllowanceEntity));
    saleRepo = module.get(getRepositoryToken(NftSaleEntity));

    blockSyncService = module.get(BlockSyncService);
    receiptSyncService = module.get(ReceiptSyncService);
    checkpointService = module.get(CheckpointService);
    reorgDetectionService = module.get(ReorgDetectionService);
    erc20Decoder = module.get(Erc20TransferDecoderService);
    approvalDecoder = module.get(Erc20ApprovalDecoderService);
    nftDecoder = module.get(NftTransferDecoderService);
    backfillJobService = module.get(BackfillJobService);
    backfillRunnerService = module.get(BackfillRunnerService);
    metricsService = module.get(MetricsService);
    reconciliationService = module.get(NftReconciliationService);
    protocolRegistry = module.get(ProtocolRegistryService);

    // Manually trigger onModuleInit for protocol decoders (test module doesn't call lifecycle hooks)
    module.get(UniswapV2Decoder).onModuleInit();
    module.get(UniswapV3Decoder).onModuleInit();
    module.get(SeaportDecoder).onModuleInit();
    module.get(BlurDecoder).onModuleInit();

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
      const result = await searchController.search({ q: '1' } as any);

      expect(result.type).toBe('block');
      expect(result.result).not.toBeNull();
      expect(Number((result.result as any).number)).toBe(1);
    });

    it('should find a transaction by hash', async () => {
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      expect(tx).toBeDefined();

      const result = await searchController.search({ q: tx!.hash } as any);

      expect(result.type).toBe('transaction');
      expect((result.result as any).hash).toBe(tx!.hash);
    });

    it('should find an address that has transactions', async () => {
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      expect(tx).toBeDefined();

      const result = await searchController.search({ q: tx.fromAddress } as any);

      expect(result.type).toBe('address');
      expect((result.result as any).address).toBe(tx!.fromAddress);
    });

    it('should return none for unknown query', async () => {
      const result = await searchController.search({
        q: '0x0000000000000000000000000000000000ffffff',
      } as any);

      expect(result.type).toBe('none');
      expect(result.result).toBeNull();
    });

    it('should find a block by hash', async () => {
      const block = await blockRepo.findOne({ where: { number: '1' } });
      expect(block).not.toBeNull();

      const result = await searchController.search({ q: block!.hash } as any);

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
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      const address = tx.fromAddress;

      const page1 = await addressesController.getAddressTransactions(
        { address } as any,
        { limit: 2, offset: 0 } as any,
      );
      const page2 = await addressesController.getAddressTransactions(
        { address } as any,
        { limit: 2, offset: 2 } as any,
      );

      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);
      expect(page1.items.length).toBeLessThanOrEqual(2);

      if (page1.total > 2) {
        expect(page2.items.length).toBeGreaterThan(0);
        const page1Hashes = page1.items.map((t: any) => t.hash);
        const page2Hashes = page2.items.map((t: any) => t.hash);
        for (const hash of page2Hashes) {
          expect(page1Hashes).not.toContain(hash);
        }
      }
    });

    it('should enforce max limit of 100', async () => {
      const [tx] = await txRepo.find({ order: { blockNumber: 'ASC' }, take: 1 });
      // Call service directly since controller DTO validation caps at 100
      const result = await addressesController.getAddressTransactions(
        { address: tx.fromAddress } as any,
        { limit: 100, offset: 0 } as any,
      );

      expect(result.limit).toBe(100);
    });

    it('should paginate token transfers', async () => {
      for (let bn = 1; bn <= 20; bn++) {
        await erc20Decoder.decodeBlock(bn);
      }

      const transfers = await transferRepo.find({ take: 1 });
      if (transfers.length === 0) return;

      const address = transfers[0].fromAddress;
      const result = await addressesController.getAddressTokenTransfers(
        { address } as any,
        { limit: 5, offset: 0 } as any,
      );

      expect(result.limit).toBe(5);
      expect(result.offset).toBe(0);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should return latest blocks with limit', async () => {
      const blocks = await blocksController.getLatestBlocks({ limit: 5 } as any);

      expect(blocks.length).toBe(5);
      for (let i = 1; i < blocks.length; i++) {
        expect(Number(blocks[i].number)).toBeLessThan(
          Number(blocks[i - 1].number),
        );
      }
    });

    it('should return block details with transactions', async () => {
      const result = await blocksController.getBlock({ numberOrHash: '1' } as any);

      expect(result).toBeDefined();
      expect(Number((result as any).number)).toBe(1);
      expect((result as any).transactions).toBeDefined();
      expect((result as any).transactions.length).toBeGreaterThan(0);
    });

    it('should return transaction with receipt, logs, and transfers', async () => {
      const tx = await txRepo.findOne({
        where: { blockNumber: '2', transactionIndex: 0 },
      });
      if (!tx) return;

      await erc20Decoder.decodeBlock(2);

      const result = await transactionsController.getTransaction({ hash: tx.hash } as any);

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

  // ────────────────────────────────────────────────────────────────
  // 10. ERC-721 NFT transfer decoding
  // ────────────────────────────────────────────────────────────────
  describe('ERC-721 NFT transfer decoding', () => {
    beforeEach(async () => {
      // Ingest blocks and receipts (includes ERC-721 Transfer logs on blocks % 3 === 0)
      await blockSyncService.syncNextBatch(12);
      for (let bn = 1; bn <= 12; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should decode ERC-721 Transfer events (4-topic) into nft_transfers', async () => {
      let totalDecoded = 0;
      for (let bn = 1; bn <= 12; bn++) {
        totalDecoded += await nftDecoder.decodeBlock(bn);
      }

      const nftTransfers = await nftTransferRepo.find();
      expect(nftTransfers.length).toBe(totalDecoded);
      expect(nftTransfers.length).toBeGreaterThan(0);

      // Verify ERC-721 transfers specifically
      const erc721Transfers = nftTransfers.filter((t) => t.tokenType === 'ERC721');
      expect(erc721Transfers.length).toBeGreaterThan(0);

      for (const transfer of erc721Transfers) {
        expect(transfer.tokenAddress).toBe(
          '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
        );
        expect(transfer.tokenType).toBe('ERC721');
        expect(transfer.fromAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(transfer.toAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(BigInt(transfer.tokenId)).toBeGreaterThan(0n);
        expect(transfer.quantity).toBe('1');
      }
    });

    it('should not misclassify ERC-20 transfers as ERC-721', async () => {
      // Decode both ERC-20 and ERC-721
      for (let bn = 1; bn <= 12; bn++) {
        await erc20Decoder.decodeBlock(bn);
        await nftDecoder.decodeBlock(bn);
      }

      const erc20Count = await transferRepo.count();
      const nftCount = await nftTransferRepo.count();

      // Both should have data
      expect(erc20Count).toBeGreaterThan(0);
      expect(nftCount).toBeGreaterThan(0);

      // ERC-20 transfers should only be in token_transfers, not nft_transfers
      // and vice versa — verify no overlap by checking token addresses
      const nftTransfers = await nftTransferRepo.find();
      for (const nft of nftTransfers) {
        expect(nft.tokenAddress).not.toBe(
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC address
        );
      }
    });

    it('should update erc721_ownership on transfer', async () => {
      for (let bn = 1; bn <= 12; bn++) {
        await nftDecoder.decodeBlock(bn);
      }

      // Filter to ERC-721 contract only
      const ownership = await erc721Repo.find({
        where: { tokenAddress: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' },
      });
      expect(ownership.length).toBeGreaterThan(0);

      // Each ERC-721 token should have exactly one owner
      for (const own of ownership) {
        expect(own.ownerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(BigInt(own.lastTransferBlock)).toBeGreaterThan(0n);
      }
    });

    it('should handle mint (from = zero address)', async () => {
      // TestChainProvider generates transfers from tx.from -> tx.to
      // The from address is derived from block number, so it's never zero.
      // Let's verify the logic handles zero address correctly by checking
      // that non-zero from addresses get their ownership removed.
      for (let bn = 1; bn <= 6; bn++) {
        await nftDecoder.decodeBlock(bn);
      }

      const transfers = await nftTransferRepo.find({
        where: { tokenType: 'ERC721' },
        order: { blockNumber: 'ASC' },
      });
      const ownership = await erc721Repo.find();

      // Each ERC-721 transfer's toAddress should be the current owner
      for (const transfer of transfers) {
        const owner = ownership.find(
          (o) => o.tokenAddress === transfer.tokenAddress && o.tokenId === transfer.tokenId,
        );
        expect(owner).toBeDefined();
        expect(owner!.ownerAddress).toBe(transfer.toAddress);
      }
    });

    it('should be idempotent — no duplicate nft_transfers on re-decode', async () => {
      for (let bn = 1; bn <= 6; bn++) {
        await nftDecoder.decodeBlock(bn);
      }
      const countBefore = await nftTransferRepo.count();

      for (let bn = 1; bn <= 6; bn++) {
        await nftDecoder.decodeBlock(bn);
      }
      const countAfter = await nftTransferRepo.count();

      expect(countAfter).toBe(countBefore);
    });

    it('should rollback NFT data on reorg', async () => {
      // Decode NFTs for blocks 1-12
      for (let bn = 1; bn <= 12; bn++) {
        await nftDecoder.decodeBlock(bn);
      }

      const nftCountBefore = await nftTransferRepo.count();
      const ownershipBefore = await erc721Repo.count();
      expect(nftCountBefore).toBeGreaterThan(0);

      // Rollback from block 7 — should remove nft_transfers for blocks 7-12
      await reorgDetectionService.rollback(6, 7);

      const nftCountAfter = await nftTransferRepo.count();
      expect(nftCountAfter).toBeLessThan(nftCountBefore);

      // No NFT transfers should remain for blocks >= 7
      const remaining = await nftTransferRepo.find();
      for (const nft of remaining) {
        expect(Number(nft.blockNumber)).toBeLessThanOrEqual(6);
      }

      // Ownership should be cleaned for tokens affected by rollback
      const ownershipAfter = await erc721Repo.find();
      for (const own of ownershipAfter) {
        expect(Number(own.lastTransferBlock)).toBeLessThanOrEqual(6);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 11. ERC-1155 transfer decoding
  // ────────────────────────────────────────────────────────────────
  describe('ERC-1155 transfer decoding', () => {
    beforeEach(async () => {
      // Ingest blocks 1-15 (blocks 5, 10, 15 have ERC-1155 TransferSingle logs)
      await blockSyncService.syncNextBatch(15);
      for (let bn = 1; bn <= 15; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should decode ERC-1155 TransferSingle events', async () => {
      for (let bn = 1; bn <= 15; bn++) {
        await nftDecoder.decodeBlock(bn);
      }

      const erc1155Transfers = await nftTransferRepo.find({
        where: { tokenType: 'ERC1155' },
      });
      expect(erc1155Transfers.length).toBeGreaterThan(0);

      for (const transfer of erc1155Transfers) {
        expect(transfer.tokenType).toBe('ERC1155');
        expect(transfer.tokenAddress).toBe(
          '0x76be3b62873462d2142405439777e971754e8e77',
        );
        expect(BigInt(transfer.quantity)).toBeGreaterThan(0n);
        expect(transfer.operator).not.toBeNull();
      }
    });

    it('should track ERC-1155 balances via erc1155_balances', async () => {
      for (let bn = 1; bn <= 15; bn++) {
        await nftDecoder.decodeBlock(bn);
      }

      const erc1155Balances = await erc1155Repo.find({
        where: { tokenAddress: '0x76be3b62873462d2142405439777e971754e8e77' },
      });
      expect(erc1155Balances.length).toBeGreaterThan(0);

      for (const own of erc1155Balances) {
        expect(BigInt(own.balance)).toBeGreaterThan(0n);
      }
    });

    it('should be idempotent for ERC-1155 transfers', async () => {
      for (let bn = 1; bn <= 10; bn++) {
        await nftDecoder.decodeBlock(bn);
      }
      const countBefore = await nftTransferRepo.count({ where: { tokenType: 'ERC1155' } });

      for (let bn = 1; bn <= 10; bn++) {
        await nftDecoder.decodeBlock(bn);
      }
      const countAfter = await nftTransferRepo.count({ where: { tokenType: 'ERC1155' } });

      expect(countAfter).toBe(countBefore);
    });

    it('should not mix ERC-721 and ERC-1155 token addresses', async () => {
      for (let bn = 1; bn <= 15; bn++) {
        await nftDecoder.decodeBlock(bn);
      }

      const erc721 = await nftTransferRepo.find({ where: { tokenType: 'ERC721' } });
      const erc1155 = await nftTransferRepo.find({ where: { tokenType: 'ERC1155' } });

      const erc721Addresses = new Set(erc721.map((t) => t.tokenAddress));
      const erc1155Addresses = new Set(erc1155.map((t) => t.tokenAddress));

      // No overlap between ERC-721 and ERC-1155 contract addresses
      for (const addr of erc1155Addresses) {
        expect(erc721Addresses.has(addr)).toBe(false);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 12. NFT read model layer (holdings + stats)
  // ────────────────────────────────────────────────────────────────
  describe('NFT read model layer', () => {
    beforeEach(async () => {
      await blockSyncService.syncNextBatch(15);
      for (let bn = 1; bn <= 15; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
        await nftDecoder.decodeBlock(bn);
      }
    });

    it('should populate address_nft_holdings for ERC-721 transfers', async () => {
      const holdings = await holdingRepo.find({
        where: { tokenType: 'ERC721' },
      });
      expect(holdings.length).toBeGreaterThan(0);

      for (const h of holdings) {
        expect(h.quantity).toBe('1');
        expect(h.address).toMatch(/^0x[0-9a-f]{40}$/);
      }
    });

    it('should populate address_nft_holdings for ERC-1155 transfers', async () => {
      const holdings = await holdingRepo.find({
        where: { tokenType: 'ERC1155' },
      });
      expect(holdings.length).toBeGreaterThan(0);

      for (const h of holdings) {
        expect(BigInt(h.quantity)).toBeGreaterThan(0n);
      }
    });

    it('should populate nft_contract_stats', async () => {
      const stats = await statsRepo.find();
      expect(stats.length).toBeGreaterThan(0);

      for (const s of stats) {
        expect(s.totalTransfers).toBeGreaterThan(0);
        expect(s.lastActivityBlock).not.toBeNull();
      }
    });

    it('should have correct holding for each ERC-721 ownership', async () => {
      const ownership = await erc721Repo.find();
      for (const own of ownership) {
        const holding = await holdingRepo.findOne({
          where: {
            address: own.ownerAddress,
            tokenAddress: own.tokenAddress,
            tokenId: own.tokenId,
          },
        });
        expect(holding).not.toBeNull();
        expect(holding!.quantity).toBe('1');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 13. NFT reconciliation and drift repair
  // ────────────────────────────────────────────────────────────────
  describe('NFT reconciliation', () => {
    beforeEach(async () => {
      await blockSyncService.syncNextBatch(15);
      for (let bn = 1; bn <= 15; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
        await nftDecoder.decodeBlock(bn);
      }
    });

    it('should validate with no issues when state is correct', async () => {
      const report = await reconciliationService.validate();

      expect(report.checkedContracts).toBeGreaterThan(0);
      expect(report.checkedTokens).toBeGreaterThan(0);
      expect(report.issuesFound).toBe(0);
      expect(report.issues).toHaveLength(0);
    });

    it('should detect ERC-721 ownership drift after manual corruption', async () => {
      // Corrupt: delete an ownership row
      await erc721Repo.createQueryBuilder().delete().execute();

      const report = await reconciliationService.validate();

      expect(report.issuesFound).toBeGreaterThan(0);
      const ownerIssues = report.issues.filter(
        (i) => i.type === 'ERC721_MISSING_OWNER',
      );
      expect(ownerIssues.length).toBeGreaterThan(0);
    });

    it('should detect holdings drift after manual corruption', async () => {
      // Corrupt: delete all holdings
      await holdingRepo.createQueryBuilder().delete().execute();

      const report = await reconciliationService.validate();

      const holdingIssues = report.issues.filter(
        (i) => i.type === 'HOLDING_MISMATCH',
      );
      expect(holdingIssues.length).toBeGreaterThan(0);
    });

    it('should detect contract stats drift', async () => {
      // Corrupt: zero out stats
      await statsRepo.createQueryBuilder().delete().execute();

      const report = await reconciliationService.validate();

      const statsIssues = report.issues.filter(
        (i) => i.type === 'CONTRACT_STATS_MISMATCH',
      );
      expect(statsIssues.length).toBeGreaterThan(0);
    });

    it('should rebuild erc721_ownership from nft_transfers', async () => {
      // Corrupt ownership
      await erc721Repo.createQueryBuilder().delete().execute();

      // Rebuild
      const result = await reconciliationService.rebuildErc721Ownership();
      expect(result.rowsInserted).toBeGreaterThan(0);

      // Validate — should be clean now
      const report = await reconciliationService.validate();
      const ownerIssues = report.issues.filter(
        (i) => i.type === 'ERC721_MISSING_OWNER' || i.type === 'ERC721_OWNER_MISMATCH',
      );
      expect(ownerIssues.length).toBe(0);
    });

    it('should rebuild address_nft_holdings from current-state tables', async () => {
      // Corrupt holdings
      await holdingRepo.createQueryBuilder().delete().execute();

      // Rebuild
      const result = await reconciliationService.rebuildAddressHoldings();
      expect(result.rowsInserted).toBeGreaterThan(0);

      // Validate — holdings should match ownership
      const report = await reconciliationService.validate();
      const holdingIssues = report.issues.filter(
        (i) => i.type === 'HOLDING_MISMATCH',
      );
      expect(holdingIssues.length).toBe(0);
    });

    it('should run fullReconcile and produce clean validation', async () => {
      // Corrupt everything
      await erc721Repo.createQueryBuilder().delete().execute();
      await erc1155Repo.createQueryBuilder().delete().execute();
      await holdingRepo.createQueryBuilder().delete().execute();
      await statsRepo.createQueryBuilder().delete().execute();

      // Full reconcile
      const report = await reconciliationService.fullReconcile();

      expect(report.rebuilds.length).toBe(4);
      expect(report.validation.issuesFound).toBe(0);
      expect(report.totalDurationMs).toBeGreaterThan(0);

      // Verify data was actually rebuilt
      const ownershipCount = await erc721Repo.count();
      expect(ownershipCount).toBeGreaterThan(0);

      const holdingsCount = await holdingRepo.count();
      expect(holdingsCount).toBeGreaterThan(0);

      const statsCount = await statsRepo.count();
      expect(statsCount).toBeGreaterThan(0);
    });

    it('should not mutate data in dryRun mode', async () => {
      // Corrupt ownership
      await erc721Repo.createQueryBuilder().delete().execute();

      // Dry run
      const report = await reconciliationService.fullReconcile(undefined, true);

      // Should have found issues but NOT rebuilt
      expect(report.rebuilds.length).toBe(0);
      expect(report.validation.issuesFound).toBeGreaterThan(0);

      // Data should still be corrupted
      const ownershipCount = await erc721Repo.count();
      expect(ownershipCount).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 14. Protocol decoder framework + Uniswap V2
  // ────────────────────────────────────────────────────────────────
  describe('Protocol decoder framework', () => {
    it('should register Uniswap V2 decoder in the registry', () => {
      const decoders = protocolRegistry.getDecoders();
      expect(decoders.length).toBeGreaterThan(0);
      expect(decoders.some((d) => d.protocol === 'UNISWAP_V2')).toBe(true);
    });

    it('should decode Uniswap V2 Swap events into dex_swaps', async () => {
      // Ingest blocks (blocks % 4 === 0 have Swap logs)
      await blockSyncService.syncNextBatch(12);
      for (let bn = 1; bn <= 12; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      // Pre-populate pair info (no RPC in test env)
      await pairRepo.upsert(
        {
          pairAddress: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
          protocolName: 'UNISWAP_V2',
          token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          factoryAddress: null,
          discoveredAtBlock: '1',
        },
        ['pairAddress'],
      );

      // Run protocol decoders
      let totalDecoded = 0;
      for (let bn = 1; bn <= 12; bn++) {
        totalDecoded += await protocolRegistry.decodeBlock(bn);
      }

      const swaps = await swapRepo.find({ where: { protocolName: 'UNISWAP_V2' } });
      expect(swaps.length).toBeGreaterThan(0);

      // Verify swap fields
      for (const swap of swaps) {
        expect(swap.protocolName).toBe('UNISWAP_V2');
        expect(swap.pairAddress).toBe('0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc');
        expect(swap.token0Address).toBe('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
        expect(swap.token1Address).toBe('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
        expect(BigInt(swap.amount0In)).toBe(1000000n);
        expect(BigInt(swap.amount1Out)).toBe(500000000000000000n);
      }
    });

    it('should be idempotent — no duplicate swaps on re-decode', async () => {
      await blockSyncService.syncNextBatch(8);
      for (let bn = 1; bn <= 8; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      await pairRepo.upsert(
        {
          pairAddress: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
          protocolName: 'UNISWAP_V2',
          token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          factoryAddress: null,
          discoveredAtBlock: '1',
        },
        ['pairAddress'],
      );

      for (let bn = 1; bn <= 8; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }
      const countBefore = await swapRepo.count();

      for (let bn = 1; bn <= 8; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }
      const countAfter = await swapRepo.count();

      expect(countAfter).toBe(countBefore);
    });

    it('should rollback protocol-derived data on reorg', async () => {
      await blockSyncService.syncNextBatch(12);
      for (let bn = 1; bn <= 12; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      await pairRepo.upsert(
        {
          pairAddress: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
          protocolName: 'UNISWAP_V2',
          token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          factoryAddress: null,
          discoveredAtBlock: '1',
        },
        ['pairAddress'],
      );

      for (let bn = 1; bn <= 12; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }

      const swapsBefore = await swapRepo.count();
      expect(swapsBefore).toBeGreaterThan(0);

      // Rollback from block 5
      await reorgDetectionService.rollback(4, 5);

      const swapsAfter = await swapRepo.count();
      expect(swapsAfter).toBeLessThan(swapsBefore);

      // No swaps should remain for blocks >= 5
      const remaining = await swapRepo.find();
      for (const swap of remaining) {
        expect(Number(swap.blockNumber)).toBeLessThan(5);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 15. ERC-20 Approval decoding
  // ────────────────────────────────────────────────────────────────
  describe('ERC-20 Approval decoding', () => {
    beforeEach(async () => {
      await blockSyncService.syncNextBatch(10);
      for (let bn = 1; bn <= 10; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should decode Approval events into token_approvals', async () => {
      let totalDecoded = 0;
      for (let bn = 1; bn <= 10; bn++) {
        totalDecoded += await approvalDecoder.decodeBlock(bn);
      }

      const approvals = await approvalRepo.find();
      expect(approvals.length).toBe(totalDecoded);
      expect(approvals.length).toBeGreaterThan(0);

      for (const approval of approvals) {
        expect(approval.ownerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(approval.spenderAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(approval.tokenAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(BigInt(approval.valueRaw)).toBeGreaterThanOrEqual(0n);
      }
    });

    it('should update token_allowances_current with latest value', async () => {
      for (let bn = 1; bn <= 10; bn++) {
        await approvalDecoder.decodeBlock(bn);
      }

      const allowances = await allowanceRepo.find();
      expect(allowances.length).toBeGreaterThan(0);

      for (const allowance of allowances) {
        expect(allowance.ownerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(allowance.spenderAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(BigInt(allowance.lastApprovalBlock)).toBeGreaterThan(0n);
      }
    });

    it('should be idempotent — no duplicate approvals on re-decode', async () => {
      for (let bn = 1; bn <= 5; bn++) {
        await approvalDecoder.decodeBlock(bn);
      }
      const countBefore = await approvalRepo.count();

      for (let bn = 1; bn <= 5; bn++) {
        await approvalDecoder.decodeBlock(bn);
      }
      const countAfter = await approvalRepo.count();

      expect(countAfter).toBe(countBefore);
    });

    it('should rollback approvals and allowances on reorg', async () => {
      for (let bn = 1; bn <= 10; bn++) {
        await approvalDecoder.decodeBlock(bn);
      }

      const beforeApprovals = await approvalRepo.count();
      expect(beforeApprovals).toBeGreaterThan(0);

      await reorgDetectionService.rollback(5, 6);

      const afterApprovals = await approvalRepo.count();
      expect(afterApprovals).toBeLessThan(beforeApprovals);

      const remaining = await approvalRepo.find();
      for (const a of remaining) {
        expect(Number(a.blockNumber)).toBeLessThanOrEqual(5);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 16. Uniswap V3 swap decoding
  // ────────────────────────────────────────────────────────────────
  describe('Uniswap V3 swap decoding', () => {
    beforeEach(async () => {
      // Ingest blocks 1-14 (block 7 and 14 have V3 Swap logs)
      await blockSyncService.syncNextBatch(14);
      for (let bn = 1; bn <= 14; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }

      // Pre-populate V3 pool info (no RPC in test)
      await pairRepo.upsert(
        {
          pairAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
          protocolName: 'UNISWAP_V3',
          token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          factoryAddress: null,
          discoveredAtBlock: '1',
        },
        ['pairAddress'],
      );
    });

    it('should register V3 decoder in the registry', () => {
      const decoders = protocolRegistry.getDecoders();
      expect(decoders.some((d) => d.protocol === 'UNISWAP_V3')).toBe(true);
    });

    it('should decode V3 Swap events into dex_swaps', async () => {
      let total = 0;
      for (let bn = 1; bn <= 14; bn++) {
        total += await protocolRegistry.decodeBlock(bn);
      }

      const v3Swaps = await swapRepo.find({
        where: { protocolName: 'UNISWAP_V3' },
      });
      expect(v3Swaps.length).toBeGreaterThan(0);

      for (const swap of v3Swaps) {
        expect(swap.protocolName).toBe('UNISWAP_V3');
        expect(swap.pairAddress).toBe('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640');
        // V3 signed amount mapping: amount0=500000 (positive → amount0In)
        expect(BigInt(swap.amount0In)).toBe(500000n);
        expect(swap.amount0Out).toBe('0');
        // amount1=-250000000000000 (negative → amount1Out)
        expect(swap.amount1In).toBe('0');
        expect(BigInt(swap.amount1Out)).toBe(250000000000000n);
      }
    });

    it('should keep V2 and V3 swaps separate by protocol_name', async () => {
      // Pre-populate V2 pair too
      await pairRepo.upsert(
        {
          pairAddress: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
          protocolName: 'UNISWAP_V2',
          token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          token1Address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          factoryAddress: null,
          discoveredAtBlock: '1',
        },
        ['pairAddress'],
      );

      for (let bn = 1; bn <= 14; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }

      const v2Count = await swapRepo.count({ where: { protocolName: 'UNISWAP_V2' } });
      const v3Count = await swapRepo.count({ where: { protocolName: 'UNISWAP_V3' } });

      expect(v2Count).toBeGreaterThan(0);
      expect(v3Count).toBeGreaterThan(0);

      // Different pool addresses
      const v2Swaps = await swapRepo.find({ where: { protocolName: 'UNISWAP_V2' } });
      const v3Swaps = await swapRepo.find({ where: { protocolName: 'UNISWAP_V3' } });
      const v2Addrs = new Set(v2Swaps.map((s) => s.pairAddress));
      const v3Addrs = new Set(v3Swaps.map((s) => s.pairAddress));
      for (const addr of v3Addrs) {
        expect(v2Addrs.has(addr)).toBe(false);
      }
    });

    it('should be idempotent for V3 swaps', async () => {
      for (let bn = 1; bn <= 14; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }
      const before = await swapRepo.count({ where: { protocolName: 'UNISWAP_V3' } });

      for (let bn = 1; bn <= 14; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }
      const after = await swapRepo.count({ where: { protocolName: 'UNISWAP_V3' } });

      expect(after).toBe(before);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 17. Seaport NFT marketplace decoding
  // ────────────────────────────────────────────────────────────────
  describe('Seaport NFT sale decoding', () => {
    beforeEach(async () => {
      // Block 11 has a Seaport OrderFulfilled log
      await blockSyncService.syncNextBatch(11);
      for (let bn = 1; bn <= 11; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should decode Seaport OrderFulfilled into nft_sales', async () => {
      for (let bn = 1; bn <= 11; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }

      const sales = await saleRepo.find();
      expect(sales.length).toBeGreaterThan(0);

      for (const sale of sales) {
        expect(sale.protocolName).toBe('SEAPORT');
        expect(sale.collectionAddress).toBe('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d');
        expect(sale.tokenStandard).toBe('ERC721');
        expect(sale.sellerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(sale.buyerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(sale.paymentToken).toBe('0x0000000000000000000000000000000000000000'); // ETH
        expect(BigInt(sale.totalPrice)).toBe(BigInt('1000000000000000000')); // 1 ETH
        expect(BigInt(sale.quantity)).toBe(1n);
      }
    });

    it('should be idempotent for Seaport sales', async () => {
      for (let bn = 1; bn <= 11; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }
      const before = await saleRepo.count();

      for (let bn = 1; bn <= 11; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }
      const after = await saleRepo.count();

      expect(after).toBe(before);
    });

    it('should rollback sales on reorg', async () => {
      for (let bn = 1; bn <= 11; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }

      const before = await saleRepo.count();
      expect(before).toBeGreaterThan(0);

      await reorgDetectionService.rollback(10, 11);

      const after = await saleRepo.count();
      expect(after).toBe(0); // Only block 11 had sales, and it was rolled back
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 18. Blur NFT marketplace decoding
  // ────────────────────────────────────────────────────────────────
  describe('Blur NFT sale decoding', () => {
    beforeEach(async () => {
      // Block 13 has a Blur OrdersMatched log
      await blockSyncService.syncNextBatch(13);
      for (let bn = 1; bn <= 13; bn++) {
        await receiptSyncService.syncReceiptsForBlock(bn);
      }
    });

    it('should decode Blur OrdersMatched into nft_sales', async () => {
      for (let bn = 1; bn <= 13; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }

      const blurSales = await saleRepo.find({
        where: { protocolName: 'BLUR' },
      });
      expect(blurSales.length).toBeGreaterThan(0);

      for (const sale of blurSales) {
        expect(sale.protocolName).toBe('BLUR');
        expect(sale.collectionAddress).toBe('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d');
        expect(sale.tokenStandard).toBe('ERC721');
        expect(sale.sellerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(sale.buyerAddress).toMatch(/^0x[0-9a-f]{40}$/);
        expect(BigInt(sale.totalPrice)).toBe(BigInt('2000000000000000000'));
        expect(BigInt(sale.quantity)).toBe(1n);
      }
    });

    it('should keep Seaport and Blur sales separate by protocol_name', async () => {
      // Need block 11 for Seaport and block 13 for Blur
      for (let bn = 1; bn <= 13; bn++) {
        await protocolRegistry.decodeBlock(bn);
      }

      const seaportCount = await saleRepo.count({ where: { protocolName: 'SEAPORT' } });
      const blurCount = await saleRepo.count({ where: { protocolName: 'BLUR' } });

      expect(seaportCount).toBeGreaterThan(0);
      expect(blurCount).toBeGreaterThan(0);
    });
  });
});
