import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TokenApprovalEntity } from '@app/db/entities/token-approval.entity';
import { TokenAllowanceEntity } from '@app/db/entities/token-allowance.entity';
import { PaginatedResponse } from '../common/pagination';

@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(TokenApprovalEntity)
    private readonly approvalRepo: Repository<TokenApprovalEntity>,

    @InjectRepository(TokenAllowanceEntity)
    private readonly allowanceRepo: Repository<TokenAllowanceEntity>,
  ) {}

  async listTokens(take: number, skip = 0) {
    const [items, total] = await this.tokenRepo.findAndCount({
      take,
      skip,
    });
    return { items, total, limit: take, offset: skip };
  }

  async getToken(address: string, transferLimit = 25, transferOffset = 0) {
    const normalized = address.toLowerCase();

    const token = await this.tokenRepo.findOne({
      where: { address: normalized },
    });

    if (!token) {
      throw new NotFoundException(`Token ${address} not found`);
    }

    const [recentTransfers, transferTotal] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: transferLimit,
      skip: transferOffset,
    });

    return { token, recentTransfers, transferTotal };
  }

  async getTokenTransfers(
    address: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<TokenTransferEntity>> {
    const normalized = address.toLowerCase();

    const [items, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { items, total, limit, offset };
  }

  async getApprovals(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<TokenApprovalEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const [items, total] = await this.approvalRepo.findAndCount({
      where: { ownerAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getAllowances(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<TokenAllowanceEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const [items, total] = await this.allowanceRepo.findAndCount({
      where: { ownerAddress: normalized },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
  ): Promise<TokenAllowanceEntity | null> {
    return this.allowanceRepo.findOne({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        ownerAddress: ownerAddress.toLowerCase(),
        spenderAddress: spenderAddress.toLowerCase(),
      },
    });
  }
}
