import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { PaginatedResponse } from '../common/pagination';

@Injectable()
export class NftsService {
  constructor(
    @InjectRepository(NftTransferEntity)
    private readonly transferRepo: Repository<NftTransferEntity>,

    @InjectRepository(Erc721OwnershipEntity)
    private readonly erc721Repo: Repository<Erc721OwnershipEntity>,

    @InjectRepository(Erc1155BalanceEntity)
    private readonly erc1155Repo: Repository<Erc1155BalanceEntity>,

    @InjectRepository(NftTokenMetadataEntity)
    private readonly metadataRepo: Repository<NftTokenMetadataEntity>,
  ) {}

  async getCollectionTransfers(
    tokenAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftTransferEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const [items, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getToken(tokenAddress: string, tokenId: string) {
    const normalized = tokenAddress.toLowerCase();

    const metadata = await this.metadataRepo.findOne({
      where: { tokenAddress: normalized, tokenId },
    });

    const erc721Owners = await this.erc721Repo.find({
      where: { tokenAddress: normalized, tokenId },
    });

    const erc1155Owners = await this.erc1155Repo.find({
      where: { tokenAddress: normalized, tokenId },
    });

    const owners = [...erc721Owners, ...erc1155Owners];

    const recentTransfers = await this.transferRepo.find({
      where: { tokenAddress: normalized, tokenId },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: 25,
    });

    return { tokenAddress: normalized, tokenId, metadata, owners, recentTransfers };
  }

  async getTokenTransfers(
    tokenAddress: string,
    tokenId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftTransferEntity>> {
    const normalized = tokenAddress.toLowerCase();
    const [items, total] = await this.transferRepo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getTokenOwners(
    tokenAddress: string,
    tokenId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<Erc721OwnershipEntity | Erc1155BalanceEntity>> {
    const normalized = tokenAddress.toLowerCase();

    // Query both tables
    const [erc721Items, erc721Total] = await this.erc721Repo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      take: limit,
      skip: offset,
    });

    const [erc1155Items, erc1155Total] = await this.erc1155Repo.findAndCount({
      where: { tokenAddress: normalized, tokenId },
      take: limit,
      skip: offset,
    });

    const items = [...erc721Items, ...erc1155Items].slice(0, limit);
    const total = erc721Total + erc1155Total;

    return { items, total, limit, offset };
  }

  async getNftsByOwner(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<Erc721OwnershipEntity | Erc1155BalanceEntity>> {
    const normalized = ownerAddress.toLowerCase();

    const [erc721Items, erc721Total] = await this.erc721Repo.findAndCount({
      where: { ownerAddress: normalized },
      take: limit,
      skip: offset,
    });

    const [erc1155Items, erc1155Total] = await this.erc1155Repo.findAndCount({
      where: { ownerAddress: normalized },
      take: limit,
      skip: offset,
    });

    const items = [...erc721Items, ...erc1155Items].slice(0, limit);
    const total = erc721Total + erc1155Total;

    return { items, total, limit, offset };
  }

  async getNftTransfersByOwner(
    ownerAddress: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResponse<NftTransferEntity>> {
    const normalized = ownerAddress.toLowerCase();
    const [items, total] = await this.transferRepo.findAndCount({
      where: [
        { fromAddress: normalized },
        { toAddress: normalized },
      ],
      order: { blockNumber: 'DESC', logIndex: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }
}
