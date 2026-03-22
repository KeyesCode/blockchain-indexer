import { ApiProperty } from '@nestjs/swagger';

export class TokenTransferDto {
  @ApiProperty({ example: '0xdbaa547d4403b891af7e51f6eb84e067441ac6a5dcc2bf3fea25aab83b913b66' })
  transactionHash!: string;

  @ApiProperty({ example: '22711829' })
  blockNumber!: string;

  @ApiProperty({ example: 0 })
  logIndex!: number;

  @ApiProperty({ example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
  tokenAddress!: string;

  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  fromAddress!: string;

  @ApiProperty({ example: '0x94f0f1df2a954b243ad95542f9b66a8e797d23c0' })
  toAddress!: string;

  @ApiProperty({ example: '1000000', description: 'Raw amount (not decimal-adjusted)' })
  amountRaw!: string;
}
