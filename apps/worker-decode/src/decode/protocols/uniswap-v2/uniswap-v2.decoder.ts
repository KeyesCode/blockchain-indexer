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
import {
  UNISWAP_V2_SWAP_TOPIC,
  UNISWAP_V2_PAIR_ABI,
  PROTOCOL_NAME,
} from './constants';

@Injectable()
export class UniswapV2Decoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(UniswapV2Decoder.name);
  private readonly provider: JsonRpcProvider | null;
  private readonly pairCache = new Map<string, { token0: string; token1: string }>();
  private readonly nonPairCache = new Set<string>();

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
        topic0: UNISWAP_V2_SWAP_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    if (logs.length === 0) return 0;

    const inserts: Partial<DexSwapEntity>[] = [];

    for (const log of logs) {
      if (!log.topic1 || !log.topic2) continue;

      // Get token0/token1 for this pair
      const pair = await this.getPairInfo(log.address, blockNumber);
      if (!pair) continue;

      try {
        const decoded = AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256', 'uint256', 'uint256'],
          log.data,
        );

        inserts.push({
          protocolName: PROTOCOL_NAME,
          pairAddress: log.address,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          senderAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
          toAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
          token0Address: pair.token0,
          token1Address: pair.token1,
          amount0In: decoded[0].toString(),
          amount1In: decoded[1].toString(),
          amount0Out: decoded[2].toString(),
          amount1Out: decoded[3].toString(),
        });
      } catch {
        this.logger.warn(
          `Failed to decode Swap ${log.transactionHash}:${log.logIndex}`,
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
    }

    if (inserts.length > 0) {
      this.logger.debug(
        `Block ${blockNumber}: decoded ${inserts.length} Uniswap V2 swaps`,
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

  /**
   * Get token0/token1 for a pair address.
   * Check in-memory cache → DB → RPC probe.
   */
  private async getPairInfo(
    pairAddress: string,
    blockNumber: number,
  ): Promise<{ token0: string; token1: string } | null> {
    const normalized = pairAddress.toLowerCase();

    // In-memory cache
    const cached = this.pairCache.get(normalized);
    if (cached) return cached;

    // Known non-pair
    if (this.nonPairCache.has(normalized)) return null;

    // DB cache
    const existing = await this.pairRepo.findOne({
      where: { pairAddress: normalized },
    });
    if (existing) {
      const info = { token0: existing.token0Address, token1: existing.token1Address };
      this.pairCache.set(normalized, info);
      return info;
    }

    // RPC probe
    if (!this.provider) {
      this.nonPairCache.add(normalized);
      return null;
    }

    try {
      const contract = new Contract(normalized, UNISWAP_V2_PAIR_ABI, this.provider);
      const [token0, token1] = await Promise.all([
        contract.token0() as Promise<string>,
        contract.token1() as Promise<string>,
      ]);

      const t0 = token0.toLowerCase();
      const t1 = token1.toLowerCase();

      let factory: string | null = null;
      try {
        factory = ((await contract.factory()) as string).toLowerCase();
      } catch {
        // factory() may not exist on all pair-like contracts
      }

      // Persist pair
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

      // Persist as protocol contract
      await this.contractRepo.upsert(
        {
          address: normalized,
          protocolName: PROTOCOL_NAME,
          contractType: 'PAIR',
          metadataJson: { token0: t0, token1: t1, factory } as any,
          discoveredAtBlock: String(blockNumber),
        },
        ['address'],
      );

      const info = { token0: t0, token1: t1 };
      this.pairCache.set(normalized, info);
      return info;
    } catch {
      this.nonPairCache.add(normalized);
      return null;
    }
  }
}
