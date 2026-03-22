import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider, AbiCoder } from 'ethers';
import { LogEntity } from '@app/db/entities/log.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { ProtocolContractEntity } from '@app/db/entities/protocol-contract.entity';
import { ProtocolDecoder } from '../protocol-decoder.interface';
import { ProtocolRegistryService } from '../protocol-registry.service';
import { UNISWAP_V3_SWAP_TOPIC, UNISWAP_V3_POOL_ABI, PROTOCOL_NAME } from './constants';

@Injectable()
export class UniswapV3Decoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(UniswapV3Decoder.name);
  private readonly provider: JsonRpcProvider | null;
  private readonly poolCache = new Map<string, { token0: string; token1: string }>();
  private readonly nonPoolCache = new Set<string>();

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(DexSwapEntity)
    private readonly swapRepo: Repository<DexSwapEntity>,

    @InjectRepository(DexPairEntity)
    private readonly pairRepo: Repository<DexPairEntity>,

    @InjectRepository(ProtocolContractEntity)
    private readonly contractRepo: Repository<ProtocolContractEntity>,

    private readonly registry: ProtocolRegistryService,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
  }

  onModuleInit(): void {
    this.registry.register(this);
  }

  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: UNISWAP_V3_SWAP_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    if (logs.length === 0) return 0;

    const inserts: Partial<DexSwapEntity>[] = [];

    for (const log of logs) {
      // V3 Swap: topics = [sig, sender, recipient]
      if (!log.topic1 || !log.topic2) continue;

      const pool = await this.getPoolInfo(log.address, blockNumber);
      if (!pool) continue;

      try {
        // Data: int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick
        const decoded = AbiCoder.defaultAbiCoder().decode(
          ['int256', 'int256', 'uint160', 'uint128', 'int24'],
          log.data,
        );

        const amount0 = decoded[0] as bigint;
        const amount1 = decoded[1] as bigint;

        // V3 uses signed amounts:
        //   positive = tokens flowing INTO the pool (user pays)
        //   negative = tokens flowing OUT of the pool (user receives)
        // Map to V2-style in/out columns:
        const amount0In = amount0 > 0n ? amount0.toString() : '0';
        const amount0Out = amount0 < 0n ? (-amount0).toString() : '0';
        const amount1In = amount1 > 0n ? amount1.toString() : '0';
        const amount1Out = amount1 < 0n ? (-amount1).toString() : '0';

        inserts.push({
          protocolName: PROTOCOL_NAME,
          pairAddress: log.address,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          senderAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
          toAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
          token0Address: pool.token0,
          token1Address: pool.token1,
          amount0In,
          amount1In,
          amount0Out,
          amount1Out,
        });
      } catch {
        this.logger.warn(
          `Failed to decode V3 Swap ${log.transactionHash}:${log.logIndex}`,
        );
      }
    }

    if (inserts.length > 0) {
      await this.swapRepo
        .createQueryBuilder()
        .insert()
        .into(DexSwapEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      this.logger.debug(
        `Block ${blockNumber}: decoded ${inserts.length} Uniswap V3 swaps`,
      );
    }

    return inserts.length;
  }

  async rollbackFrom(blockNumber: number): Promise<void> {
    await this.swapRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :bn AND "protocol_name" = :proto', {
        bn: String(blockNumber),
        proto: PROTOCOL_NAME,
      })
      .execute();
  }

  private async getPoolInfo(
    poolAddress: string,
    blockNumber: number,
  ): Promise<{ token0: string; token1: string } | null> {
    const normalized = poolAddress.toLowerCase();

    const cached = this.poolCache.get(normalized);
    if (cached) return cached;

    // DB cache (reuse dex_pairs) — check before nonPoolCache so newly-registered pools are found
    const existing = await this.pairRepo.findOne({
      where: { pairAddress: normalized },
    });
    if (existing) {
      const info = { token0: existing.token0Address, token1: existing.token1Address };
      this.poolCache.set(normalized, info);
      return info;
    }

    // Only check nonPoolCache after DB miss
    if (this.nonPoolCache.has(normalized)) return null;

    if (!this.provider) {
      this.nonPoolCache.add(normalized);
      return null;
    }

    try {
      const contract = new Contract(normalized, UNISWAP_V3_POOL_ABI, this.provider);
      const [token0, token1] = await Promise.all([
        contract.token0() as Promise<string>,
        contract.token1() as Promise<string>,
      ]);
      const t0 = token0.toLowerCase();
      const t1 = token1.toLowerCase();

      let fee: number | null = null;
      let factory: string | null = null;
      try {
        fee = Number(await contract.fee());
        factory = ((await contract.factory()) as string).toLowerCase();
      } catch {}

      await this.pairRepo.upsert(
        {
          pairAddress: normalized,
          protocolName: PROTOCOL_NAME,
          factoryAddress: factory,
          token0Address: t0,
          token1Address: t1,
          discoveredAtBlock: String(blockNumber),
        },
        ['pairAddress'],
      );

      await this.contractRepo.upsert(
        {
          address: normalized,
          protocolName: PROTOCOL_NAME,
          contractType: 'POOL',
          metadataJson: { token0: t0, token1: t1, fee, factory } as any,
          discoveredAtBlock: String(blockNumber),
        },
        ['address'],
      );

      const info = { token0: t0, token1: t1 };
      this.poolCache.set(normalized, info);
      return info;
    } catch {
      this.nonPoolCache.add(normalized);
      return null;
    }
  }
}
