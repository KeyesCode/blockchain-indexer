import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { BackfillJobEntity } from '@app/db/entities/backfill-job.entity';
import { AddressSummaryEntity } from '@app/db/entities/address-summary.entity';
import { TokenStatsEntity } from '@app/db/entities/token-stats.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { ProtocolContractEntity } from '@app/db/entities/protocol-contract.entity';
import { SummaryService } from '@app/db/services/summary.service';
import { PartitionManagerService } from '@app/db/services/partition-manager.service';
import { BackfillJobService } from './services/backfill-job.service';
import { BackfillRunnerService } from './services/backfill-runner.service';
import { RangePlannerService } from './services/range-planner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlockEntity,
      TransactionEntity,
      TransactionReceiptEntity,
      LogEntity,
      TokenTransferEntity,
      BackfillJobEntity,
      AddressSummaryEntity,
      TokenStatsEntity,
      NftTransferEntity,
      Erc721OwnershipEntity,
      Erc1155BalanceEntity,
      DexSwapEntity,
      DexPairEntity,
      ProtocolContractEntity,
    ]),
  ],
  providers: [BackfillJobService, BackfillRunnerService, RangePlannerService, SummaryService, PartitionManagerService],
  exports: [BackfillJobService, BackfillRunnerService, RangePlannerService],
})
export class BackfillModule {}
