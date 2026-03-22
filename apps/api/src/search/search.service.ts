import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';

export interface SearchResult {
  type: 'transaction' | 'block' | 'token' | 'address' | 'none';
  result: any;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,

    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,
  ) {}

  async search(query: string): Promise<SearchResult> {
    const q = query.trim().toLowerCase();

    // Transaction hash or block hash (66 chars starting with 0x)
    if (q.startsWith('0x') && q.length === 66) {
      const tx = await this.txRepo.findOne({ where: { hash: q } });
      if (tx) {
        return { type: 'transaction', result: tx };
      }

      const block = await this.blockRepo.findOne({ where: { hash: q } });
      if (block) {
        return { type: 'block', result: block };
      }
    }

    // Address (42 chars starting with 0x)
    if (q.startsWith('0x') && q.length === 42) {
      const token = await this.tokenRepo.findOne({ where: { address: q } });
      if (token) {
        return { type: 'token', result: token };
      }

      // Any valid-length address resolves — the address page handles empty state
      return { type: 'address', result: { address: q } };
    }

    // Block number (only plain digits)
    if (!q.startsWith('0x') && /^\d+$/.test(q)) {
      const block = await this.blockRepo.findOne({
        where: { number: q },
      });
      if (block) {
        return { type: 'block', result: block };
      }
    }

    return { type: 'none', result: null };
  }
}
