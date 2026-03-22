import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockDto {
  @ApiProperty({ example: '22711829' })
  number!: string;

  @ApiProperty({ example: '0x582eb76560f0262e49756b951e33b523a9350ad93459b1c74ee9b7441398da9e' })
  hash!: string;

  @ApiProperty({ example: '0x9e56a1da55838c801b2f7a2bef69ecf6be657db7056ddc5b668b286bb22d802f' })
  parentHash!: string;

  @ApiProperty({ example: '2025-06-15T18:49:23.000Z' })
  timestamp!: Date;

  @ApiProperty({ example: '36000000' })
  gasLimit!: string;

  @ApiProperty({ example: '18976081' })
  gasUsed!: string;

  @ApiPropertyOptional({ example: '449584825', nullable: true })
  baseFeePerGas!: string | null;

  @ApiPropertyOptional({ example: '0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5', nullable: true })
  miner!: string | null;
}
