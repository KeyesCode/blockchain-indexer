import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(BlockEntity)
    private readonly blockRepo: Repository<BlockEntity>,

    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
  ) {}

  async getLatestBlocks(take: number, skip = 0) {
    const [items, total] = await this.blockRepo.findAndCount({
      order: { number: 'DESC' },
      take,
      skip,
    });
    return { items, total, limit: take, offset: skip };
  }

  async getBlock(numberOrHash: string) {
    const isHash = numberOrHash.startsWith('0x');

    const block = isHash
      ? await this.blockRepo.findOne({
          where: { hash: numberOrHash.toLowerCase() },
        })
      : await this.blockRepo.findOne({
          where: { number: numberOrHash },
        });

    if (!block) {
      throw new NotFoundException(`Block ${numberOrHash} not found`);
    }

    const transactions = await this.txRepo.find({
      where: { blockNumber: block.number },
      order: { transactionIndex: 'ASC' },
    });

    return { ...block, transactions };
  }
}
