import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { PaginationQueryDto } from '../common/pagination';
import { BlockIdentifierParamDto } from '../common/params';
import { BlockDto, ApiPaginatedResponse } from '../common/dto';
import { BlockDetailDto } from './dto/block-detail.dto';

@ApiTags('Blocks')
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get latest indexed blocks (paginated)' })
  @ApiPaginatedResponse(BlockDto)
  async getLatestBlocks(@Query() query: PaginationQueryDto) {
    return this.blocksService.getLatestBlocks(query.limit!, query.offset!);
  }

  @Get(':numberOrHash')
  @ApiOperation({ summary: 'Get block by number or hash' })
  @ApiOkResponse({ type: BlockDetailDto })
  async getBlock(@Param() params: BlockIdentifierParamDto) {
    return this.blocksService.getBlock(params.numberOrHash);
  }
}
