import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokensService } from './tokens.service';
import { PaginationQueryDto, LimitQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';
import { TokenContractDto, TokenTransferDto, ApiPaginatedResponse } from '../common/dto';
import { TokenDetailDto } from './dto/token-detail.dto';

@ApiTags('Tokens')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  @ApiOperation({ summary: 'List indexed token contracts' })
  @ApiOkResponse({ type: [TokenContractDto] })
  async listTokens(@Query() query: LimitQueryDto) {
    return this.tokensService.listTokens(query.limit!);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get token contract with recent transfers' })
  @ApiOkResponse({ type: TokenDetailDto })
  async getToken(@Param() params: AddressParamDto) {
    return this.tokensService.getToken(params.address);
  }

  @Get(':address/transfers')
  @ApiOperation({ summary: 'Get paginated transfers for a token' })
  @ApiPaginatedResponse(TokenTransferDto)
  async getTokenTransfers(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tokensService.getTokenTransfers(
      params.address,
      query.limit!,
      query.offset!,
    );
  }
}
