import { Controller, Get, Post, Body, Param, Patch, Query, ParseIntPipe } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { MetadataBackfillService } from './metadata-backfill.service';
import { NftReconciliationService } from '@app/db/services/nft-reconciliation.service';
import { LimitQueryDto } from '../common/pagination';
import { CreateBackfillJobDto } from './dto/create-backfill-job.dto';
import { AdminStatusDto } from './dto/admin-status.dto';
import { AdminMetricsDto } from './dto/admin-metrics.dto';
import { BackfillJobDto } from './dto/backfill-job.dto';
import { ReorgEventDto } from './dto/reorg-event.dto';
import { NftReconcileReportDto, NftValidationReportDto, NftRebuildResultDto } from './dto/nft-reconciliation.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly metadataBackfill: MetadataBackfillService,
    private readonly reconciliation: NftReconciliationService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get indexer status overview' })
  @ApiOkResponse({ type: AdminStatusDto })
  async getStatus() {
    return this.adminService.getStatus();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get indexer metrics for monitoring' })
  @ApiOkResponse({ type: AdminMetricsDto })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('checkpoints')
  @ApiOperation({ summary: 'Get per-worker sync checkpoints' })
  async getCheckpoints() {
    return this.adminService.getCheckpoints();
  }

  @Get('backfill-jobs')
  @ApiOperation({ summary: 'List all backfill jobs' })
  @ApiOkResponse({ type: [BackfillJobDto] })
  async getBackfillJobs() {
    return this.adminService.getBackfillJobs();
  }

  @Post('backfill-jobs')
  @ApiOperation({ summary: 'Create a new backfill job' })
  @ApiCreatedResponse({ type: BackfillJobDto })
  async createBackfillJob(@Body() dto: CreateBackfillJobDto) {
    return this.adminService.createBackfillJob(
      dto.fromBlock,
      dto.toBlock,
      dto.batchSize,
    );
  }

  @Patch('backfill-jobs/:id/pause')
  @ApiOperation({ summary: 'Pause a running backfill job' })
  async pauseJob(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.pauseJob(id);
  }

  @Patch('backfill-jobs/:id/resume')
  @ApiOperation({ summary: 'Resume a paused backfill job' })
  async resumeJob(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.resumeJob(id);
  }

  @Get('reorgs')
  @ApiOperation({ summary: 'Get recent chain reorganization events' })
  @ApiOkResponse({ type: [ReorgEventDto] })
  async getReorgEvents(@Query() query: LimitQueryDto) {
    return this.adminService.getReorgEvents(query.limit!);
  }

  // ── NFT Reconciliation ──

  @Post('nfts/reconcile')
  @ApiOperation({ summary: 'Full NFT reconcile: rebuild all derived tables + validate' })
  @ApiOkResponse({ type: NftReconcileReportDto })
  async nftReconcile(@Query('dryRun') dryRun?: string) {
    return this.reconciliation.fullReconcile(undefined, dryRun === 'true');
  }

  @Post('nfts/recompute-contract/:address')
  @ApiOperation({ summary: 'Recompute stats and rebuild for one NFT contract' })
  @ApiOkResponse({ type: NftReconcileReportDto })
  async nftRecomputeContract(@Param('address') address: string) {
    return this.reconciliation.fullReconcile(address.toLowerCase());
  }

  @Post('nfts/rebuild-holdings')
  @ApiOperation({ summary: 'Rebuild address_nft_holdings from current-state tables' })
  @ApiOkResponse({ type: NftRebuildResultDto })
  async nftRebuildHoldings() {
    return this.reconciliation.rebuildAddressHoldings();
  }

  @Post('nfts/rebuild-current-state')
  @ApiOperation({ summary: 'Rebuild erc721_ownership + erc1155_balances from nft_transfers' })
  @ApiOkResponse({ type: [NftRebuildResultDto] })
  async nftRebuildCurrentState() {
    const erc721 = await this.reconciliation.rebuildErc721Ownership();
    const erc1155 = await this.reconciliation.rebuildErc1155Balances();
    return [erc721, erc1155];
  }

  @Get('nfts/validate')
  @ApiOperation({ summary: 'Validate all NFT derived tables (read-only)' })
  @ApiOkResponse({ type: NftValidationReportDto })
  async nftValidate() {
    return this.reconciliation.validate();
  }

  @Get('nfts/validate/:address')
  @ApiOperation({ summary: 'Validate NFT data for one contract (read-only)' })
  @ApiOkResponse({ type: NftValidationReportDto })
  async nftValidateContract(@Param('address') address: string) {
    return this.reconciliation.validate(address.toLowerCase());
  }

  // ── Metadata Backfill ──

  @Post('metadata/backfill-tokens')
  @ApiOperation({
    summary: 'Backfill token_contracts for all tokens in token_transfers missing metadata',
  })
  async backfillTokenMetadata() {
    return this.metadataBackfill.backfillTokenContracts();
  }

  @Post('metadata/backfill-nfts')
  @ApiOperation({
    summary: 'Backfill nft_token_metadata for NFTs in nft_transfers missing metadata',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max tokens to process (default 1000)' })
  @ApiQuery({ name: 'fetchContent', required: false, description: 'Also fetch metadata from IPFS/HTTP (default true)' })
  async backfillNftMetadata(
    @Query('limit') limit?: string,
    @Query('fetchContent') fetchContent?: string,
  ) {
    return this.metadataBackfill.backfillNftMetadata({
      limit: limit ? Number(limit) : undefined,
      fetchContent: fetchContent !== 'false',
    });
  }
}
