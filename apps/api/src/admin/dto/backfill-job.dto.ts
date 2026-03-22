import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BackfillJobDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'completed', enum: ['pending', 'running', 'paused', 'completed', 'failed'] })
  status!: string;

  @ApiProperty({ example: '22711828' })
  fromBlock!: string;

  @ApiProperty({ example: '22711957' })
  toBlock!: string;

  @ApiProperty({ example: '22711957' })
  currentBlock!: string;

  @ApiProperty({ example: 10 })
  batchSize!: number;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
