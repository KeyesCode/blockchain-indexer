import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DexSwapDto {
  @ApiProperty({ example: 'UNISWAP_V2' })
  protocolName!: string;

  @ApiProperty({ example: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc' })
  pairAddress!: string;

  @ApiProperty({ example: '0xdbaa547d...' })
  transactionHash!: string;

  @ApiProperty({ example: '22711829' })
  blockNumber!: string;

  @ApiProperty({ example: 5 })
  logIndex!: number;

  @ApiPropertyOptional({ nullable: true })
  senderAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  toAddress!: string | null;

  @ApiProperty({ example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
  token0Address!: string;

  @ApiProperty({ example: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' })
  token1Address!: string;

  @ApiProperty({ example: '1000000' })
  amount0In!: string;

  @ApiProperty({ example: '0' })
  amount1In!: string;

  @ApiProperty({ example: '0' })
  amount0Out!: string;

  @ApiProperty({ example: '500000000000000000' })
  amount1Out!: string;
}
