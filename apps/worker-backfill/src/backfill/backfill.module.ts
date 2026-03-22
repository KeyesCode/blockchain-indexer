import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { BackfillJobEntity } from '@app/db/entities/backfill-job.entity';
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
    ]),
  ],
  providers: [BackfillJobService, BackfillRunnerService, RangePlannerService],
  exports: [BackfillJobService, BackfillRunnerService, RangePlannerService],
})
export class BackfillModule {}
