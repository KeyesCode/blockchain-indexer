import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import {
  CursorPaginatedResponse,
  parseCursor,
  buildCursor,
} from '../common/pagination';

@Injectable()
export class ProtocolsService {
  constructor(
    @InjectRepository(DexSwapEntity)
    private readonly swapRepo: Repository<DexSwapEntity>,

    @InjectRepository(DexPairEntity)
    private readonly pairRepo: Repository<DexPairEntity>,
  ) {}

  async getSwaps(
    limit: number,
    cursor?: string,
    filters?: { pairAddress?: string; protocolName?: string },
  ): Promise<CursorPaginatedResponse<DexSwapEntity>> {
    const parsed = parseCursor(cursor);

    const qb = this.swapRepo.createQueryBuilder('s')
      .orderBy('s.block_number', 'DESC')
      .addOrderBy('s.log_index', 'DESC')
      .take(limit + 1);

    if (filters?.pairAddress) {
      qb.andWhere('s.pair_address = :pair', { pair: filters.pairAddress.toLowerCase() });
    }
    if (filters?.protocolName) {
      qb.andWhere('s.protocol_name = :proto', { proto: filters.protocolName });
    }
    if (parsed) {
      qb.andWhere(
        '(s.block_number < :bn OR (s.block_number = :bn AND s.log_index < :li))',
        { bn: parsed.blockNumber, li: parsed.logIndex },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? buildCursor(items[items.length - 1].blockNumber, items[items.length - 1].logIndex)
      : null;

    return { items, nextCursor, limit };
  }

  async getSwapsByTx(txHash: string): Promise<DexSwapEntity[]> {
    return this.swapRepo.find({
      where: { transactionHash: txHash.toLowerCase() },
      order: { logIndex: 'ASC' },
    });
  }

  async getPairSwaps(
    pairAddress: string,
    limit: number,
    cursor?: string,
  ): Promise<CursorPaginatedResponse<DexSwapEntity>> {
    return this.getSwaps(limit, cursor, { pairAddress });
  }

  async getAddressSwaps(
    address: string,
    limit: number,
    cursor?: string,
  ): Promise<CursorPaginatedResponse<DexSwapEntity>> {
    const normalized = address.toLowerCase();
    const parsed = parseCursor(cursor);

    const qb = this.swapRepo.createQueryBuilder('s')
      .where('(s.sender_address = :addr OR s.to_address = :addr)', { addr: normalized })
      .orderBy('s.block_number', 'DESC')
      .addOrderBy('s.log_index', 'DESC')
      .take(limit + 1);

    if (parsed) {
      qb.andWhere(
        '(s.block_number < :bn OR (s.block_number = :bn AND s.log_index < :li))',
        { bn: parsed.blockNumber, li: parsed.logIndex },
      );
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? buildCursor(items[items.length - 1].blockNumber, items[items.length - 1].logIndex)
      : null;

    return { items, nextCursor, limit };
  }

  async getPair(pairAddress: string): Promise<DexPairEntity | null> {
    return this.pairRepo.findOne({
      where: { pairAddress: pairAddress.toLowerCase() },
    });
  }
}
