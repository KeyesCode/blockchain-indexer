import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceiptDto {
  @ApiProperty({ example: '0xdbaa547d4403b891af7e51f6eb84e067441ac6a5dcc2bf3fea25aab83b913b66' })
  transactionHash!: string;

  @ApiProperty({ example: '22711829' })
  blockNumber!: string;

  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  fromAddress!: string;

  @ApiPropertyOptional({ example: '0x94f0f1df2a954b243ad95542f9b66a8e797d23c0', nullable: true })
  toAddress!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Contract address if this was a contract creation' })
  contractAddress!: string | null;

  @ApiProperty({ example: '21000' })
  gasUsed!: string;

  @ApiProperty({ example: '411565' })
  cumulativeGasUsed!: string;

  @ApiPropertyOptional({ example: '1949584825', nullable: true })
  effectiveGasPrice!: string | null;

  @ApiProperty({ example: 1, description: '1 = success, 0 = revert' })
  status!: number;
}
