import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenContractDto {
  @ApiProperty({ example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
  address!: string;

  @ApiPropertyOptional({ example: 'USDC', nullable: true })
  symbol!: string | null;

  @ApiPropertyOptional({ example: 'USD Coin', nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ example: 6, nullable: true })
  decimals!: number | null;

  @ApiPropertyOptional({ nullable: true })
  totalSupply!: string | null;

  @ApiProperty({ example: 'ERC20' })
  standard!: string;
}
