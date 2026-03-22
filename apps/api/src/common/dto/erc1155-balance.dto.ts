import { ApiProperty } from '@nestjs/swagger';

export class Erc1155BalanceDto {
  @ApiProperty({ example: '0x76be3b62873462d2142405439777e971754e8e77' })
  tokenAddress!: string;

  @ApiProperty({ example: '1' })
  tokenId!: string;

  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  ownerAddress!: string;

  @ApiProperty({ example: '100', description: 'Token balance for this owner' })
  balance!: string;

  @ApiProperty({ example: '22711829' })
  lastTransferBlock!: string;

  @ApiProperty()
  updatedAt!: Date;
}
