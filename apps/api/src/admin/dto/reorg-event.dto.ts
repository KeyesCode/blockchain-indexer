import { ApiProperty } from '@nestjs/swagger';

export class ReorgEventDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty()
  detectedAt!: Date;

  @ApiProperty({ example: '22711900' })
  reorgBlock!: string;

  @ApiProperty({ example: 1 })
  depth!: number;

  @ApiProperty({ example: '0xabc...' })
  oldHash!: string;

  @ApiProperty({ example: '0xdef...' })
  newHash!: string;

  @ApiProperty({ example: '22711899' })
  commonAncestorBlock!: string;
}
