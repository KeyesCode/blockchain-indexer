import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DbCountsDto {
  @ApiProperty({ example: 130 })
  blocks!: number;

  @ApiProperty({ example: 25805 })
  transactions!: number;

  @ApiProperty({ example: 42000 })
  logs!: number;

  @ApiProperty({ example: 3200 })
  token_transfers!: number;
}

class SyncStateDto {
  @ApiPropertyOptional({ example: '22711957', nullable: true })
  indexed_head!: string | null;

  @ApiProperty({ description: 'Worker name -> last synced block number', example: { 'block-sync': 22711957 } })
  checkpoints!: Record<string, number>;
}

class BackfillCountsDto {
  @ApiProperty({ example: 0 })
  active_jobs!: number;

  @ApiProperty({ example: 0 })
  failed_jobs!: number;
}

class ReorgCountsDto {
  @ApiProperty({ example: 0 })
  total!: number;
}

export class AdminMetricsDto {
  @ApiProperty({ type: DbCountsDto })
  db!: DbCountsDto;

  @ApiProperty({ type: SyncStateDto })
  sync!: SyncStateDto;

  @ApiProperty({ type: BackfillCountsDto })
  backfill!: BackfillCountsDto;

  @ApiProperty({ type: ReorgCountsDto })
  reorgs!: ReorgCountsDto;
}
