import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from './entities/block.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionReceiptEntity } from './entities/transaction-receipt.entity';
import { LogEntity } from './entities/log.entity';
import { TokenContractEntity } from './entities/token-contract.entity';
import { TokenTransferEntity } from './entities/token-transfer.entity';
import { SyncCheckpointEntity } from './entities/sync-checkpoint.entity';
import { BackfillJobEntity } from './entities/backfill-job.entity';
import { ReorgEventEntity } from './entities/reorg-event.entity';
import { AddressSummaryEntity } from './entities/address-summary.entity';
import { TokenStatsEntity } from './entities/token-stats.entity';
import { NftTransferEntity } from './entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from './entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from './entities/erc1155-balance.entity';
import { NftTokenMetadataEntity } from './entities/nft-token-metadata.entity';

const entities = [
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
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'blockchain_indexer',
      entities,
      synchronize: false,
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DbModule {}
