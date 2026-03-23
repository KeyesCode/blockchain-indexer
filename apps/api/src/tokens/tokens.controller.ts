import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokensService } from './tokens.service';
import { PaginationQueryDto } from '../common/pagination';
import { AddressParamDto } from '../common/params';
import { TokenContractDto, TokenTransferDto, ApiPaginatedResponse } from '../common/dto';
import { TokenDetailDto } from './dto/token-detail.dto';
import { TokenApprovalDto, TokenAllowanceDto } from './dto/token-approval.dto';

@ApiTags('Tokens')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  @ApiOperation({ summary: 'List indexed token contracts (paginated)' })
  @ApiPaginatedResponse(TokenContractDto)
  async listTokens(@Query() query: PaginationQueryDto) {
    return this.tokensService.listTokens(query.limit!, query.offset!);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get token contract with recent transfers' })
  @ApiOkResponse({ type: TokenDetailDto })
  async getToken(
    @Param() params: AddressParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tokensService.getToken(params.address, query.limit!, query.offset!);
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

  @Get(':address/allowance/:owner/:spender')
  @ApiOperation({ summary: 'Get current allowance for a specific owner/spender pair' })
  @ApiOkResponse({ type: TokenAllowanceDto })
  async getAllowance(
    @Param('address') tokenAddress: string,
    @Param('owner') ownerAddress: string,
    @Param('spender') spenderAddress: string,
  ) {
    return this.tokensService.getAllowance(tokenAddress, ownerAddress, spenderAddress);
  }
}
