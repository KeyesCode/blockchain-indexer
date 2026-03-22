import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainProvider, CHAIN_PROVIDER } from '@app/chain-provider';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { ProtocolContractEntity } from '@app/db/entities/protocol-contract.entity';
import { TokenApprovalEntity } from '@app/db/entities/token-approval.entity';
import { TokenAllowanceEntity } from '@app/db/entities/token-allowance.entity';
import { BackfillJobEntity, BackfillJobStatus } from '@app/db/entities/backfill-job.entity';
import { BackfillJobService } from './backfill-job.service';
import { normalizeAddress, normalizeHash, MetricsService } from '@app/common';
import { withRetry } from '@app/common/utils/retry';
import {
  ERC20_TRANSFER_TOPIC,
  ERC20_APPROVAL_TOPIC,
  ERC1155_TRANSFER_SINGLE_TOPIC,
  ERC1155_TRANSFER_BATCH_TOPIC,
} from '@app/abi';
import { AbiCoder } from 'ethers';
import { topicToAddress } from '@app/common';
import { SummaryService } from '@app/db/services/summary.service';
import { PartitionManagerService } from '@app/db/services/partition-manager.service';
import { Contract, JsonRpcProvider } from 'ethers';

const UNISWAP_V2_SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
const UNISWAP_V3_SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const UNISWAP_V2_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function factory() view returns (address)',
];

@Injectable()
export class BackfillRunnerService {
  private readonly logger = new Logger(BackfillRunnerService.name);
  private running = false;

  constructor(
    @Inject(CHAIN_PROVIDER)
    private readonly chainProvider: ChainProvider,

    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TransactionReceiptEntity)
    private readonly receiptRepo: Repository<TransactionReceiptEntity>,

    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(NftTransferEntity)
    private readonly nftTransferRepo: Repository<NftTransferEntity>,

    @InjectRepository(Erc721OwnershipEntity)
    private readonly erc721Repo: Repository<Erc721OwnershipEntity>,

    @InjectRepository(Erc1155BalanceEntity)
    private readonly erc1155Repo: Repository<Erc1155BalanceEntity>,

    @InjectRepository(TokenApprovalEntity)
    private readonly approvalRepo: Repository<TokenApprovalEntity>,

    @InjectRepository(TokenAllowanceEntity)
    private readonly allowanceRepo: Repository<TokenAllowanceEntity>,

    private readonly jobService: BackfillJobService,

    private readonly metrics: MetricsService,

    private readonly summaryService: SummaryService,

    private readonly partitionManager: PartitionManagerService,

    @InjectRepository(DexSwapEntity)
    private readonly swapRepo: Repository<DexSwapEntity>,

    @InjectRepository(DexPairEntity)
    private readonly pairRepo: Repository<DexPairEntity>,

    @InjectRepository(ProtocolContractEntity)
    private readonly protocolContractRepo: Repository<ProtocolContractEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.rpcProvider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
  }

  private readonly rpcProvider: JsonRpcProvider | null;
  private readonly pairCache = new Map<string, { token0: string; token1: string }>();
  private readonly nonPairCache = new Set<string>();

  async processNextJob(): Promise<boolean> {
    if (this.running) return false;

    const jobs = await this.jobService.getActiveJobs();
    if (jobs.length === 0) return false;

    const job = jobs[0];
    this.running = true;

    try {
      await this.runJob(job);
      return true;
    } catch (error) {
      await this.jobService.markFailed(job.id, (error as Error).message);
      return false;
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: BackfillJobEntity): Promise<void> {
    const fromBlock = Number(job.currentBlock);
    const toBlock = Number(job.toBlock);
    const batchSize = job.batchSize;

    this.logger.log(
      `Starting backfill job #${job.id}: ${fromBlock} -> ${toBlock} (batch=${batchSize})`,
    );

    // Ensure partitions exist for the full job range
    await this.partitionManager.ensurePartitionsForBlock(fromBlock);
    await this.partitionManager.ensurePartitionsForBlock(toBlock);

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      // Check if job was paused
      const currentJob = await this.jobService.getJob(job.id);
      if (!currentJob || currentJob.status === BackfillJobStatus.PAUSED) {
        this.logger.log(`Job #${job.id} paused at block ${start}`);
        return;
      }

      const end = Math.min(start + batchSize - 1, toBlock);

      for (let blockNumber = start; blockNumber <= end; blockNumber++) {
        await this.syncFullBlock(blockNumber);
      }

      // Update derived read models for this batch
      await this.summaryService.updateAddressSummariesForRange(start, end);
      await this.summaryService.updateTokenStatsForRange(start, end);

      await this.jobService.updateProgress(job.id, end);

      const blocksInBatch = end - start + 1;
      this.metrics.increment('backfill.blocks_synced', blocksInBatch);
      this.metrics.recordRate('backfill.blocks', blocksInBatch);
      this.metrics.setGauge('backfill.current_block', end);

      const totalBlocks = toBlock - Number(job.fromBlock);
      const doneBlocks = end - Number(job.fromBlock);
      const pct = totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 100;
      this.metrics.setGauge('backfill.progress_pct', pct);

      this.logger.debug(`Job #${job.id}: synced through block ${end} (${pct}%)`);
    }

    await this.jobService.markCompleted(job.id);
  }

  private async syncFullBlock(blockNumber: number): Promise<void> {
    const block = await withRetry(() =>
      this.chainProvider.getBlockWithTransactions(blockNumber),
    );
    if (!block) return;

    // Insert block
    await this.blockRepo.upsert(
      {
        number: String(block.number),
        hash: normalizeHash(block.hash),
        parentHash: normalizeHash(block.parentHash),
        timestamp: new Date(block.timestamp * 1000),
        gasLimit: block.gasLimit,
        gasUsed: block.gasUsed,
        baseFeePerGas: block.baseFeePerGas ?? null,
        miner: block.miner ? normalizeAddress(block.miner) : null,
      },
      ['number'],
    );

    // Insert transactions
    if (block.transactions.length > 0) {
      await this.txRepo
        .createQueryBuilder()
        .insert()
        .into(TransactionEntity)
        .values(
          block.transactions.map((tx) => ({
            hash: normalizeHash(tx.hash),
            blockNumber: String(tx.blockNumber),
            transactionIndex: tx.transactionIndex,
            fromAddress: normalizeAddress(tx.from),
            toAddress: tx.to ? normalizeAddress(tx.to) : null,
            value: tx.value,
            inputData: tx.input,
            nonce: String(tx.nonce),
            gas: tx.gas,
            gasPrice: tx.gasPrice ?? null,
            maxFeePerGas: tx.maxFeePerGas ?? null,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
            type: tx.type ?? null,
          })),
        )
        .orIgnore()
        .execute();

      // Fetch and store receipts + logs
      for (const tx of block.transactions) {
        const receipt = await withRetry(() =>
          this.chainProvider.getTransactionReceipt(tx.hash),
        );
        if (!receipt) continue;

        await this.receiptRepo
          .createQueryBuilder()
          .insert()
          .into(TransactionReceiptEntity)
          .values({
            transactionHash: normalizeHash(receipt.transactionHash),
            blockNumber: String(receipt.blockNumber),
            fromAddress: normalizeAddress(receipt.from),
            toAddress: receipt.to ? normalizeAddress(receipt.to) : null,
            contractAddress: receipt.contractAddress
              ? normalizeAddress(receipt.contractAddress)
              : null,
            gasUsed: receipt.gasUsed,
            cumulativeGasUsed: receipt.cumulativeGasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice ?? null,
            status: receipt.status,
          })
          .orIgnore()
          .execute();

        if (receipt.logs.length > 0) {
          await this.logRepo
            .createQueryBuilder()
            .insert()
            .into(LogEntity)
            .values(
              receipt.logs.map((log) => ({
                blockNumber: String(log.blockNumber),
                transactionHash: normalizeHash(log.transactionHash),
                transactionIndex: log.transactionIndex,
                logIndex: log.logIndex,
                address: normalizeAddress(log.address),
                topic0: log.topics[0]?.toLowerCase() ?? null,
                topic1: log.topics[1]?.toLowerCase() ?? null,
                topic2: log.topics[2]?.toLowerCase() ?? null,
                topic3: log.topics[3]?.toLowerCase() ?? null,
                data: log.data,
                removed: log.removed,
              })),
            )
            .orIgnore()
            .execute();

          // Decode ERC-20 transfers inline from the receipt logs
          const transferInserts: Partial<TokenTransferEntity>[] = [];
          for (const log of receipt.logs) {
            const topic0 = log.topics[0]?.toLowerCase() ?? null;
            const topic1 = log.topics[1]?.toLowerCase() ?? null;
            const topic2 = log.topics[2]?.toLowerCase() ?? null;
            const topic3 = log.topics[3]?.toLowerCase() ?? null;

            // ERC-20 Transfer: 3 topics (topic0 + 2 indexed), value in data
            if (topic0 === ERC20_TRANSFER_TOPIC && topic1 && topic2 && !topic3) {
              try {
                transferInserts.push({
                  transactionHash: normalizeHash(log.transactionHash),
                  blockNumber: String(log.blockNumber),
                  logIndex: log.logIndex,
                  tokenAddress: normalizeAddress(log.address),
                  fromAddress: topicToAddress(topic1),
                  toAddress: topicToAddress(topic2),
                  amountRaw: BigInt(log.data).toString(),
                });
              } catch {
                // Skip logs with unparseable data
              }
            }
          }

          if (transferInserts.length > 0) {
            await this.transferRepo
              .createQueryBuilder()
              .insert()
              .into(TokenTransferEntity)
              .values(transferInserts)
              .orIgnore()
              .execute();
          }

          // Decode ERC-20 Approval events inline
          const approvalInserts: Partial<TokenApprovalEntity>[] = [];
          for (const log of receipt.logs) {
            const at0 = log.topics[0]?.toLowerCase() ?? null;
            const at1 = log.topics[1]?.toLowerCase() ?? null;
            const at2 = log.topics[2]?.toLowerCase() ?? null;
            const at3 = log.topics[3]?.toLowerCase() ?? null;

            if (at0 === ERC20_APPROVAL_TOPIC && at1 && at2 && !at3) {
              try {
                approvalInserts.push({
                  transactionHash: normalizeHash(log.transactionHash),
                  blockNumber: String(log.blockNumber),
                  logIndex: log.logIndex,
                  tokenAddress: normalizeAddress(log.address),
                  ownerAddress: topicToAddress(at1),
                  spenderAddress: topicToAddress(at2),
                  valueRaw: BigInt(log.data).toString(),
                });
              } catch { /* skip */ }
            }
          }

          if (approvalInserts.length > 0) {
            await this.approvalRepo
              .createQueryBuilder()
              .insert()
              .into(TokenApprovalEntity)
              .values(approvalInserts)
              .orIgnore()
              .execute();

            for (const a of approvalInserts) {
              await this.allowanceRepo.upsert(
                {
                  tokenAddress: a.tokenAddress!,
                  ownerAddress: a.ownerAddress!,
                  spenderAddress: a.spenderAddress!,
                  valueRaw: a.valueRaw!,
                  lastApprovalBlock: a.blockNumber!,
                  updatedAt: new Date(),
                },
                ['tokenAddress', 'ownerAddress', 'spenderAddress'],
              );
            }
          }

          // Decode ERC-721 transfers inline (4-topic Transfer logs)
          const nftInserts: Partial<NftTransferEntity>[] = [];
          for (const log of receipt.logs) {
            const t0 = log.topics[0]?.toLowerCase() ?? null;
            const t1 = log.topics[1]?.toLowerCase() ?? null;
            const t2 = log.topics[2]?.toLowerCase() ?? null;
            const t3 = log.topics[3]?.toLowerCase() ?? null;

            // ERC-721 Transfer: 4 topics (topic0 + from + to + tokenId)
            if (t0 === ERC20_TRANSFER_TOPIC && t1 && t2 && t3) {
              try {
                nftInserts.push({
                  transactionHash: normalizeHash(log.transactionHash),
                  blockNumber: String(log.blockNumber),
                  logIndex: log.logIndex,
                  tokenAddress: normalizeAddress(log.address),
                  tokenType: 'ERC721',
                  fromAddress: topicToAddress(t1),
                  toAddress: topicToAddress(t2),
                  tokenId: BigInt(t3).toString(),
                  quantity: '1',
                  operator: null,
                });
              } catch {
                // Skip unparseable tokenId
              }
            }
          }

          if (nftInserts.length > 0) {
            await this.nftTransferRepo
              .createQueryBuilder()
              .insert()
              .into(NftTransferEntity)
              .values(nftInserts)
              .orIgnore()
              .execute();

            // Update ERC-721 ownership
            const zeroAddr = '0x0000000000000000000000000000000000000000';
            for (const nft of nftInserts) {
              if (nft.toAddress === zeroAddr) {
                // Burn — remove the ownership row
                await this.erc721Repo.delete({
                  tokenAddress: nft.tokenAddress!,
                  tokenId: nft.tokenId!,
                });
              } else {
                // Mint or transfer — upsert with new owner
                await this.erc721Repo.upsert(
                  {
                    tokenAddress: nft.tokenAddress!,
                    tokenId: nft.tokenId!,
                    ownerAddress: nft.toAddress!,
                    lastTransferBlock: nft.blockNumber!,
                    updatedAt: new Date(),
                  },
                  ['tokenAddress', 'tokenId'],
                );
              }
            }
          }

          // Decode ERC-1155 transfers inline
          const erc1155Inserts: Partial<NftTransferEntity>[] = [];
          for (const log of receipt.logs) {
            const t0 = log.topics[0]?.toLowerCase() ?? null;
            const t1 = log.topics[1]?.toLowerCase() ?? null;
            const t2 = log.topics[2]?.toLowerCase() ?? null;
            const t3 = log.topics[3]?.toLowerCase() ?? null;

            if (t0 === ERC1155_TRANSFER_SINGLE_TOPIC && t1 && t2 && t3) {
              try {
                const decoded = AbiCoder.defaultAbiCoder().decode(
                  ['uint256', 'uint256'],
                  log.data,
                );
                erc1155Inserts.push({
                  transactionHash: normalizeHash(log.transactionHash),
                  blockNumber: String(log.blockNumber),
                  logIndex: log.logIndex,
                  tokenAddress: normalizeAddress(log.address),
                  tokenType: 'ERC1155',
                  fromAddress: topicToAddress(t2),
                  toAddress: topicToAddress(t3),
                  tokenId: decoded[0].toString(),
                  quantity: decoded[1].toString(),
                  operator: topicToAddress(t1),
                });
              } catch { /* skip */ }
            }

            if (t0 === ERC1155_TRANSFER_BATCH_TOPIC && t1 && t2 && t3) {
              try {
                const decoded = AbiCoder.defaultAbiCoder().decode(
                  ['uint256[]', 'uint256[]'],
                  log.data,
                );
                const ids: bigint[] = decoded[0];
                const vals: bigint[] = decoded[1];
                for (let bi = 0; bi < ids.length; bi++) {
                  erc1155Inserts.push({
                    transactionHash: normalizeHash(log.transactionHash),
                    blockNumber: String(log.blockNumber),
                    logIndex: log.logIndex * 1000 + bi,
                    tokenAddress: normalizeAddress(log.address),
                    tokenType: 'ERC1155',
                    fromAddress: topicToAddress(t2),
                    toAddress: topicToAddress(t3),
                    tokenId: ids[bi].toString(),
                    quantity: vals[bi].toString(),
                    operator: topicToAddress(t1),
                  });
                }
              } catch { /* skip */ }
            }
          }

          if (erc1155Inserts.length > 0) {
            await this.nftTransferRepo
              .createQueryBuilder()
              .insert()
              .into(NftTransferEntity)
              .values(erc1155Inserts)
              .orIgnore()
              .execute();

            // Update ERC-1155 balances
            const zeroAddr = '0x0000000000000000000000000000000000000000';
            for (const t of erc1155Inserts) {
              const qty = BigInt(t.quantity!);
              if (t.fromAddress !== zeroAddr) {
                const existing = await this.erc1155Repo.findOne({
                  where: { tokenAddress: t.tokenAddress!, tokenId: t.tokenId!, ownerAddress: t.fromAddress! },
                });
                if (existing) {
                  const newBal = BigInt(existing.balance) - qty;
                  if (newBal <= 0n) {
                    await this.erc1155Repo.delete({
                      tokenAddress: t.tokenAddress!, tokenId: t.tokenId!, ownerAddress: t.fromAddress!,
                    });
                  } else {
                    await this.erc1155Repo.update(
                      { tokenAddress: t.tokenAddress!, tokenId: t.tokenId!, ownerAddress: t.fromAddress! },
                      { balance: newBal.toString(), lastTransferBlock: t.blockNumber!, updatedAt: new Date() },
                    );
                  }
                }
              }
              if (t.toAddress !== zeroAddr) {
                const existing = await this.erc1155Repo.findOne({
                  where: { tokenAddress: t.tokenAddress!, tokenId: t.tokenId!, ownerAddress: t.toAddress! },
                });
                const newBal = existing ? BigInt(existing.balance) + qty : qty;
                await this.erc1155Repo.upsert(
                  {
                    tokenAddress: t.tokenAddress!, tokenId: t.tokenId!, ownerAddress: t.toAddress!,
                    balance: newBal.toString(), lastTransferBlock: t.blockNumber!, updatedAt: new Date(),
                  },
                  ['tokenAddress', 'tokenId', 'ownerAddress'],
                );
              }
            }
          }
        }

        // ── Protocol decoding: Uniswap V2 Swaps ──
        for (const log of receipt.logs) {
          const st0 = log.topics[0]?.toLowerCase() ?? null;
          if (st0 !== UNISWAP_V2_SWAP_TOPIC) continue;
          if (!log.topics[1] || !log.topics[2]) continue;

          const pair = await this.getPairInfo(normalizeAddress(log.address), blockNumber);
          if (!pair) continue;

          try {
            const decoded = AbiCoder.defaultAbiCoder().decode(
              ['uint256', 'uint256', 'uint256', 'uint256'],
              log.data,
            );

            await this.swapRepo
              .createQueryBuilder()
              .insert()
              .into(DexSwapEntity)
              .values({
                protocolName: 'UNISWAP_V2',
                pairAddress: normalizeAddress(log.address),
                transactionHash: normalizeHash(log.transactionHash),
                blockNumber: String(log.blockNumber),
                logIndex: log.logIndex,
                senderAddress: topicToAddress(log.topics[1]),
                toAddress: topicToAddress(log.topics[2]),
                token0Address: pair.token0,
                token1Address: pair.token1,
                amount0In: decoded[0].toString(),
                amount1In: decoded[1].toString(),
                amount0Out: decoded[2].toString(),
                amount1Out: decoded[3].toString(),
              })
              .orIgnore()
              .execute();
          } catch {
            // Skip unparseable swap logs
          }
        }

        // ── Protocol decoding: Uniswap V3 Swaps ──
        for (const log of receipt.logs) {
          const sv3 = log.topics[0]?.toLowerCase() ?? null;
          if (sv3 !== UNISWAP_V3_SWAP_TOPIC) continue;
          if (!log.topics[1] || !log.topics[2]) continue;

          const pool = await this.getPairInfo(normalizeAddress(log.address), blockNumber);
          if (!pool) continue;

          try {
            const decoded = AbiCoder.defaultAbiCoder().decode(
              ['int256', 'int256', 'uint160', 'uint128', 'int24'],
              log.data,
            );
            const amt0 = decoded[0] as bigint;
            const amt1 = decoded[1] as bigint;

            await this.swapRepo
              .createQueryBuilder()
              .insert()
              .into(DexSwapEntity)
              .values({
                protocolName: 'UNISWAP_V3',
                pairAddress: normalizeAddress(log.address),
                transactionHash: normalizeHash(log.transactionHash),
                blockNumber: String(log.blockNumber),
                logIndex: log.logIndex,
                senderAddress: topicToAddress(log.topics[1]),
                toAddress: topicToAddress(log.topics[2]),
                token0Address: pool.token0,
                token1Address: pool.token1,
                amount0In: amt0 > 0n ? amt0.toString() : '0',
                amount1In: amt1 > 0n ? amt1.toString() : '0',
                amount0Out: amt0 < 0n ? (-amt0).toString() : '0',
                amount1Out: amt1 < 0n ? (-amt1).toString() : '0',
              })
              .orIgnore()
              .execute();
          } catch {
            // Skip unparseable V3 swap logs
          }
        }
      }
    }
  }

  /**
   * Get token0/token1 for a Uniswap V2/V3 pair/pool.
   * Cache → DB → RPC probe.
   */
  private async getPairInfo(
    pairAddress: string,
    blockNumber: number,
  ): Promise<{ token0: string; token1: string } | null> {
    const cached = this.pairCache.get(pairAddress);
    if (cached) return cached;
    if (this.nonPairCache.has(pairAddress)) return null;

    const existing = await this.pairRepo.findOne({ where: { pairAddress } });
    if (existing) {
      const info = { token0: existing.token0Address, token1: existing.token1Address };
      this.pairCache.set(pairAddress, info);
      return info;
    }

    if (!this.rpcProvider) {
      this.nonPairCache.add(pairAddress);
      return null;
    }

    try {
      const contract = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.rpcProvider);
      const [token0, token1] = await Promise.all([
        contract.token0() as Promise<string>,
        contract.token1() as Promise<string>,
      ]);
      const t0 = token0.toLowerCase();
      const t1 = token1.toLowerCase();

      let factory: string | null = null;
      try { factory = ((await contract.factory()) as string).toLowerCase(); } catch {}

      await this.pairRepo.upsert({
        pairAddress, protocolName: 'UNISWAP_V2', factoryAddress: factory,
        token0Address: t0, token1Address: t1, discoveredAtBlock: String(blockNumber),
      }, ['pairAddress']);

      await this.protocolContractRepo.upsert({
        address: pairAddress, protocolName: 'UNISWAP_V2', contractType: 'PAIR',
        metadataJson: { token0: t0, token1: t1, factory } as any,
        discoveredAtBlock: String(blockNumber),
      }, ['address']);

      const info = { token0: t0, token1: t1 };
      this.pairCache.set(pairAddress, info);
      return info;
    } catch {
      this.nonPairCache.add(pairAddress);
      return null;
    }
  }
}
