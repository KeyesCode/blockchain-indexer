import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionDto {
  @ApiProperty({ example: '0xdbaa547d4403b891af7e51f6eb84e067441ac6a5dcc2bf3fea25aab83b913b66' })
  hash!: string;

  @ApiProperty({ example: '22711829' })
  blockNumber!: string;

  @ApiProperty({ example: 3 })
  transactionIndex!: number;

  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  fromAddress!: string;

  @ApiPropertyOptional({ example: '0x94f0f1df2a954b243ad95542f9b66a8e797d23c0', nullable: true })
  toAddress!: string | null;

  @ApiProperty({ example: '38276000000000000' })
  value!: string;

  @ApiProperty({ example: '0x' })
  inputData!: string;

  @ApiProperty({ example: '78' })
  nonce!: string;

  @ApiProperty({ example: '21000' })
  gas!: string;

  @ApiPropertyOptional({ example: '1949584825', nullable: true })
  gasPrice!: string | null;

  @ApiPropertyOptional({ example: '3581135540', nullable: true })
  maxFeePerGas!: string | null;

  @ApiPropertyOptional({ example: '1500000000', nullable: true })
  maxPriorityFeePerGas!: string | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  type!: number | null;
}
