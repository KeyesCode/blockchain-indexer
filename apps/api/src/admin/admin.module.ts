import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { BackfillJobEntity } from '@app/db/entities/backfill-job.entity';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MetadataBackfillService } from './metadata-backfill.service';
import { NftReconciliationService } from '@app/db/services/nft-reconciliation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SyncCheckpointEntity,
      BackfillJobEntity,
      BlockEntity,
      TransactionEntity,
      LogEntity,
      TokenTransferEntity,
      TokenContractEntity,
      NftTokenMetadataEntity,
      NftTransferEntity,
      ReorgEventEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, MetadataBackfillService, NftReconciliationService],
})
export class AdminModule {}
