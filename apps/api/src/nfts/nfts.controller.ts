import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NftsService } from './nfts.service';
import { PaginationQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';
import { NftTransferDto, Erc721OwnershipDto, ApiPaginatedResponse } from '../common/dto';
import { NftTokenDetailDto } from './dto/nft-token-detail.dto';

@ApiTags('NFTs')
@Controller('nfts')
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  @Get('collections/:address/transfers')
  @ApiOperation({ summary: 'Get paginated transfers for an NFT collection' })
  @ApiPaginatedResponse(NftTransferDto)
  async getCollectionTransfers(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.nftsService.getCollectionTransfers(
      params.address,
      query.limit!,
      query.offset!,
    );
  }

  @Get('collections/:address/tokens/:tokenId')
  @ApiOperation({ summary: 'Get NFT token details with metadata and owners' })
  @ApiOkResponse({ type: NftTokenDetailDto })
  async getToken(
    @Param('address') address: string,
    @Param('tokenId') tokenId: string,
  ) {
    return this.nftsService.getToken(address, tokenId);
  }

  @Get('collections/:address/tokens/:tokenId/transfers')
  @ApiOperation({ summary: 'Get transfer history for a specific token' })
  @ApiPaginatedResponse(NftTransferDto)
  async getTokenTransfers(
    @Param('address') address: string,
    @Param('tokenId') tokenId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.nftsService.getTokenTransfers(
      address,
      tokenId,
      query.limit!,
      query.offset!,
    );
  }

  @Get('collections/:address/tokens/:tokenId/owners')
  @ApiOperation({ summary: 'Get current owners of a token (ERC-1155 may have multiple)' })
  @ApiPaginatedResponse(Erc721OwnershipDto)
  async getTokenOwners(
    @Param('address') address: string,
    @Param('tokenId') tokenId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.nftsService.getTokenOwners(
      address,
      tokenId,
      query.limit!,
      query.offset!,
    );
  }
}
