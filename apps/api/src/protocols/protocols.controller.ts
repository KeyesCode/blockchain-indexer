import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtocolsService } from './protocols.service';
import { CursorQueryDto } from '../common/pagination';
import { ApiCursorPaginatedResponse } from '../common/dto';
import { DexSwapDto } from './dto/dex-swap.dto';

@ApiTags('Protocols')
@Controller('protocols')
export class ProtocolsController {
  constructor(private readonly protocolsService: ProtocolsService) {}

  @Get('dex/swaps')
  @ApiOperation({ summary: 'Get cursor-paginated DEX swaps' })
  @ApiCursorPaginatedResponse(DexSwapDto)
  async getSwaps(
    @Query() query: CursorQueryDto,
    @Query('pairAddress') pairAddress?: string,
    @Query('protocolName') protocolName?: string,
  ) {
    return this.protocolsService.getSwaps(
      query.limit!,
      query.cursor,
      { pairAddress, protocolName },
    );
  }

  @Get('dex/swaps/:txHash')
  @ApiOperation({ summary: 'Get DEX swaps for a transaction' })
  async getSwapsByTx(@Param('txHash') txHash: string) {
    return this.protocolsService.getSwapsByTx(txHash);
  }

  @Get('dex/pairs/:address/swaps')
  @ApiOperation({ summary: 'Get cursor-paginated swaps for a pair' })
  @ApiCursorPaginatedResponse(DexSwapDto)
  async getPairSwaps(
    @Param('address') address: string,
    @Query() query: CursorQueryDto,
  ) {
    return this.protocolsService.getPairSwaps(address, query.limit!, query.cursor);
  }

  @Get('dex/pairs/:address')
  @ApiOperation({ summary: 'Get DEX pair info (token0, token1, factory)' })
  async getPair(@Param('address') address: string) {
    return this.protocolsService.getPair(address);
  }
}
