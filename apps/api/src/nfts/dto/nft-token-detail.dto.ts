import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NftTokenMetadataDto } from '../../common/dto/nft-token-metadata.dto';
import { Erc721OwnershipDto } from '../../common/dto/erc721-ownership.dto';
import { Erc1155BalanceDto } from '../../common/dto/erc1155-balance.dto';
import { NftTransferDto } from '../../common/dto/nft-transfer.dto';

export class NftTokenDetailDto {
  @ApiProperty({ example: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' })
  tokenAddress!: string;

  @ApiProperty({ example: '7090' })
  tokenId!: string;

  @ApiPropertyOptional({ type: NftTokenMetadataDto, nullable: true })
  metadata!: NftTokenMetadataDto | null;

  @ApiProperty({ type: [Erc721OwnershipDto] })
  owners!: (Erc721OwnershipDto | Erc1155BalanceDto)[];

  @ApiProperty({ type: [NftTransferDto] })
  recentTransfers!: NftTransferDto[];
}
