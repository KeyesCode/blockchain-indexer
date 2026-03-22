import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { PaginationQueryDto, LimitQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';
import { TransactionDto, TokenTransferDto, ApiPaginatedResponse } from '../common/dto';
import { AddressOverviewDto } from './dto/address-overview.dto';

@ApiTags('Addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

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
}
