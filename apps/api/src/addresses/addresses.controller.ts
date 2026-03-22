import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { NftsService } from '../nfts/nfts.service';
import { ProtocolsService } from '../protocols/protocols.service';
import { PaginationQueryDto, CursorQueryDto, LimitQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';
import { TransactionDto, TokenTransferDto, Erc721OwnershipDto, NftTransferDto, ApiPaginatedResponse, ApiCursorPaginatedResponse } from '../common/dto';
import { AddressOverviewDto } from './dto/address-overview.dto';

@ApiTags('Addresses')
@Controller('addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly nftsService: NftsService,
    private readonly protocolsService: ProtocolsService,
  ) {}

  @Get(':address')
  @ApiOperation({ summary: 'Get address overview with recent activity' })
  @ApiOkResponse({ type: AddressOverviewDto })
  async getAddressOverview(
    @Param() params: AddressParamDto,
    @Query() query: LimitQueryDto,
  ) {
    return this.addressesService.getOverview(params.address, query.limit!);
  }

  @Get(':address/transactions')
  @ApiOperation({ summary: 'Get paginated transactions for an address' })
  @ApiPaginatedResponse(TransactionDto)
  async getAddressTransactions(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.addressesService.getTransactions(
      params.address,
      query.limit!,
      query.offset!,
    );
  }

  @Get(':address/token-transfers')
  @ApiOperation({ summary: 'Get paginated token transfers for an address' })
  @ApiPaginatedResponse(TokenTransferDto)
  async getAddressTokenTransfers(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.addressesService.getTokenTransfers(
      params.address,
      query.limit!,
      query.offset!,
    );
  }

  @Get(':address/nfts')
  @ApiOperation({ summary: 'Get NFTs owned by an address' })
  @ApiPaginatedResponse(Erc721OwnershipDto)
  async getAddressNfts(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.nftsService.getNftsByOwner(
      params.address,
      query.limit!,
      query.offset!,
    );
  }

  @Get(':address/nft-transfers')
  @ApiOperation({ summary: 'Get cursor-paginated NFT transfer history for an address' })
  @ApiCursorPaginatedResponse(NftTransferDto)
  async getAddressNftTransfers(
    @Param() params: AddressParamDto,
    @Query() query: CursorQueryDto,
  ) {
    return this.nftsService.getNftTransfersByOwner(
      params.address,
      query.limit!,
      query.cursor,
    );
  }

  @Get(':address/dex-swaps')
  @ApiOperation({ summary: 'Get cursor-paginated DEX swaps for an address' })
  async getAddressDexSwaps(
    @Param() params: AddressParamDto,
    @Query() query: CursorQueryDto,
  ) {
    return this.protocolsService.getAddressSwaps(
      params.address,
      query.limit!,
      query.cursor,
    );
  }
}
