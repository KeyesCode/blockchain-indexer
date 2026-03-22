import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncCheckpointEntity } from '@app/db/entities/sync-checkpoint.entity';
import { BackfillJobEntity, BackfillJobStatus } from '@app/db/entities/backfill-job.entity';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { ReorgEventEntity } from '@app/db/entities/reorg-event.entity';

@Controller('admin')
export class AdminController {
  constructor(
    @InjectRepository(SyncCheckpointEntity)
    private readonly checkpointRepo: Repository<SyncCheckpointEntity>,

    @InjectRepository(BackfillJobEntity)
    private readonly jobRepo: Repository<BackfillJobEntity>,

    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(ReorgEventEntity)
    private readonly reorgRepo: Repository<ReorgEventEntity>,
  ) {}

  @Get('status')
  async getStatus() {
    const [checkpoints, activeJobs, blockCount, txCount, logCount, transferCount] =
      await Promise.all([
        this.checkpointRepo.find(),
        this.jobRepo.find({
          where: [
            { status: BackfillJobStatus.PENDING },
            { status: BackfillJobStatus.RUNNING },
          ],
        }),
        this.blockRepo.count(),
        this.txRepo.count(),
        this.logRepo.count(),
        this.transferRepo.count(),
      ]);

    const [latestBlock] = await this.blockRepo.find({
      order: { number: 'DESC' },
      take: 1,
    });

    const [earliestBlock] = await this.blockRepo.find({
      order: { number: 'ASC' },
      take: 1,
    });

    const reorgCount = await this.reorgRepo.count();

    return {
      indexedHead: latestBlock?.number ?? null,
      earliestBlock: earliestBlock?.number ?? null,
      counts: {
        blocks: blockCount,
        transactions: txCount,
        logs: logCount,
        tokenTransfers: transferCount,
      },
      checkpoints: checkpoints.map((cp) => ({
        worker: cp.workerName,
        lastBlock: cp.lastSyncedBlock,
        updatedAt: cp.updatedAt,
      })),
      backfill: {
        activeJobs: activeJobs.length,
        jobs: activeJobs.map((j) => ({
          id: j.id,
          status: j.status,
          range: `${j.fromBlock} -> ${j.toBlock}`,
          current: j.currentBlock,
          batchSize: j.batchSize,
        })),
      },
      reorgCount,
    };
  }

  @Get('metrics')
  async getMetrics() {
    const [blockCount, txCount, logCount, transferCount] = await Promise.all([
      this.blockRepo.count(),
      this.txRepo.count(),
      this.logRepo.count(),
      this.transferRepo.count(),
    ]);

    const [latestBlock] = await this.blockRepo.find({
      order: { number: 'DESC' },
      take: 1,
    });

    const checkpoints = await this.checkpointRepo.find();

    const activeJobs = await this.jobRepo.count({
      where: [
        { status: BackfillJobStatus.PENDING },
        { status: BackfillJobStatus.RUNNING },
      ],
    });

    const failedJobs = await this.jobRepo.count({
      where: { status: BackfillJobStatus.FAILED },
    });

    const reorgCount = await this.reorgRepo.count();

    return {
      db: {
        blocks: blockCount,
        transactions: txCount,
        logs: logCount,
        token_transfers: transferCount,
      },
      sync: {
        indexed_head: latestBlock?.number ?? null,
        checkpoints: Object.fromEntries(
          checkpoints.map((cp) => [cp.workerName, Number(cp.lastSyncedBlock)]),
        ),
      },
      backfill: {
        active_jobs: activeJobs,
        failed_jobs: failedJobs,
      },
      reorgs: {
        total: reorgCount,
      },
    };
  }

  @Get('checkpoints')
  async getCheckpoints() {
    return this.checkpointRepo.find();
  }

  @Get('backfill-jobs')
  async getBackfillJobs() {
    return this.jobRepo.find({ order: { id: 'DESC' } });
  }

  @Post('backfill-jobs')
  async createBackfillJob(
    @Body() body: { fromBlock: number; toBlock: number; batchSize?: number },
  ) {
    const job = this.jobRepo.create({
      fromBlock: String(body.fromBlock),
      toBlock: String(body.toBlock),
      currentBlock: String(body.fromBlock),
      batchSize: body.batchSize ?? 250,
      status: BackfillJobStatus.PENDING,
    });
    return this.jobRepo.save(job);
  }

  @Patch('backfill-jobs/:id/pause')
  async pauseJob(@Param('id') id: number) {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.PAUSED,
      updatedAt: new Date(),
    });
    return { message: `Job ${id} paused` };
  }

  @Patch('backfill-jobs/:id/resume')
  async resumeJob(@Param('id') id: number) {
    await this.jobRepo.update(id, {
      status: BackfillJobStatus.PENDING,
      updatedAt: new Date(),
    });
    return { message: `Job ${id} resumed` };
  }

  @Get('reorgs')
  async getReorgEvents(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit ?? 25), 100);
    return this.reorgRepo.find({
      order: { detectedAt: 'DESC' },
      take,
    });
  }
}
