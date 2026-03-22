import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class IndexerCountsDto {
  @ApiProperty({ example: 130 })
  blocks!: number;

  @ApiProperty({ example: 25805 })
  transactions!: number;

  @ApiProperty({ example: 42000 })
  logs!: number;

  @ApiProperty({ example: 3200 })
  tokenTransfers!: number;
}

class CheckpointDto {
  @ApiProperty({ example: 'block-sync' })
  worker!: string;

  @ApiProperty({ example: '22711957' })
  lastBlock!: string;

  @ApiProperty()
  updatedAt!: Date;
}

class ActiveJobDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'running' })
  status!: string;

  @ApiProperty({ example: '22711828 -> 22711957' })
  range!: string;

  @ApiProperty({ example: '22711900' })
  current!: string;

  @ApiProperty({ example: 10 })
  batchSize!: number;
}

class BackfillSummaryDto {
  @ApiProperty({ example: 1 })
  activeJobs!: number;

  @ApiProperty({ type: [ActiveJobDto] })
  jobs!: ActiveJobDto[];
}

export class AdminStatusDto {
  @ApiPropertyOptional({ example: '22711957', nullable: true })
  indexedHead!: string | null;

  @ApiPropertyOptional({ example: '22711828', nullable: true })
  earliestBlock!: string | null;

  @ApiProperty({ type: IndexerCountsDto })
  counts!: IndexerCountsDto;

  @ApiProperty({ type: [CheckpointDto] })
  checkpoints!: CheckpointDto[];

  @ApiProperty({ type: BackfillSummaryDto })
  backfill!: BackfillSummaryDto;

  @ApiProperty({ example: 0 })
  reorgCount!: number;
}
