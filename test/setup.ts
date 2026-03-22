import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DataSource } from 'typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { BackfillJobEntity } from '@app/db/entities/backfill-job.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';
import { AddressSummaryEntity } from '@app/db/entities/address-summary.entity';
import { TokenStatsEntity } from '@app/db/entities/token-stats.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { AddressNftHoldingEntity } from '@app/db/entities/address-nft-holding.entity';
import { NftContractStatsEntity } from '@app/db/entities/nft-contract-stats.entity';
import { ContractStandardEntity } from '@app/db/entities/contract-standard.entity';
import { ProtocolContractEntity } from '@app/db/entities/protocol-contract.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { CHAIN_PROVIDER } from '@app/chain-provider/chain-provider.interface';
import { QUEUE_NAMES } from '@app/queue/queue.constants';
import { MetricsService } from '@app/common/metrics/metrics.service';
import { TestChainProvider } from './test-chain-provider';

export const ALL_ENTITIES = [
  BlockEntity,
  TransactionEntity,
  TransactionReceiptEntity,
  LogEntity,
  TokenContractEntity,
  TokenTransferEntity,
  SyncCheckpointEntity,
  BackfillJobEntity,
  ReorgEventEntity,
  AddressSummaryEntity,
  TokenStatsEntity,
  NftTransferEntity,
  Erc721OwnershipEntity,
  Erc1155BalanceEntity,
  NftTokenMetadataEntity,
  AddressNftHoldingEntity,
  NftContractStatsEntity,
  ContractStandardEntity,
  ProtocolContractEntity,
  DexPairEntity,
  DexSwapEntity,
];

/**
 * Creates a NestJS testing module wired to a real Postgres test database
 * with a controllable TestChainProvider and mock Bull queues.
 *
 * Requires a running Postgres instance. Uses `synchronize: true` to
 * auto-create tables from entities (no migrations needed in test).
 */
export async function createTestModule(
  providers: any[] = [],
  controllers: any[] = [],
): Promise<{ module: TestingModule; chainProvider: TestChainProvider; decodeQueue: MockQueue }> {
  const chainProvider = new TestChainProvider();
  const decodeQueue = new MockQueue();
  const backfillQueue = new MockQueue();

  const moduleBuilder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'blockchain_indexer_test',
        entities: ALL_ENTITIES,
        synchronize: true,
        dropSchema: true,
      }),
      TypeOrmModule.forFeature(ALL_ENTITIES),
      BullModule.registerQueue(
        { name: QUEUE_NAMES.DECODE_LOGS },
        { name: QUEUE_NAMES.BACKFILL_RANGE },
        { name: QUEUE_NAMES.NFT_METADATA },
      ),
    ],
    providers: [
      {
        provide: CHAIN_PROVIDER,
        useValue: chainProvider,
      },
      MetricsService,
      ...providers,
    ],
    controllers,
  });

  const metadataQueue = new MockQueue();

  // Override Bull queues with mocks (Bull requires Redis, tests should not)
  const module = await moduleBuilder
    .overrideProvider(`BullQueue_${QUEUE_NAMES.DECODE_LOGS}`)
    .useValue(decodeQueue)
    .overrideProvider(`BullQueue_${QUEUE_NAMES.BACKFILL_RANGE}`)
    .useValue(backfillQueue)
    .overrideProvider(`BullQueue_${QUEUE_NAMES.NFT_METADATA}`)
    .useValue(metadataQueue)
    .compile();

  return { module, chainProvider, decodeQueue };
}

/**
 * Clears all rows from all entity tables.
 */
export async function clearDatabase(module: TestingModule): Promise<void> {
  const dataSource = module.get(DataSource);
  // Order matters due to foreign keys
  await dataSource.query('DELETE FROM "token_transfers"');
  await dataSource.query('DELETE FROM "logs"');
  await dataSource.query('DELETE FROM "transaction_receipts"');
  await dataSource.query('DELETE FROM "transactions"');
  await dataSource.query('DELETE FROM "blocks"');
  await dataSource.query('DELETE FROM "token_contracts"');
  await dataSource.query('DELETE FROM "sync_checkpoints"');
  await dataSource.query('DELETE FROM "backfill_jobs"');
  await dataSource.query('DELETE FROM "reorg_events"');
  await dataSource.query('DELETE FROM "address_summaries"');
  await dataSource.query('DELETE FROM "token_stats"');
  await dataSource.query('DELETE FROM "nft_token_metadata"');
  await dataSource.query('DELETE FROM "erc721_ownership"');
  await dataSource.query('DELETE FROM "erc1155_balances"');
  await dataSource.query('DELETE FROM "nft_transfers"');
  await dataSource.query('DELETE FROM "address_nft_holdings"');
  await dataSource.query('DELETE FROM "nft_contract_stats"');
  await dataSource.query('DELETE FROM "contract_standards"');
  await dataSource.query('DELETE FROM "dex_swaps"');
  await dataSource.query('DELETE FROM "dex_pairs"');
  await dataSource.query('DELETE FROM "protocol_contracts"');
}

/**
 * Mock Bull queue that captures jobs in memory.
 */
export class MockQueue {
  public jobs: Array<{ name: string; data: any; opts?: any }> = [];

  async add(name: string, data: any, opts?: any): Promise<any> {
    this.jobs.push({ name, data, opts });
    return { id: this.jobs.length };
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return {
      waiting: this.jobs.length,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  clear(): void {
    this.jobs = [];
  }
}
