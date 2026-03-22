import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import {
  ERC20_TRANSFER_TOPIC,
  ERC1155_TRANSFER_SINGLE_TOPIC,
  ERC1155_TRANSFER_BATCH_TOPIC,
} from '@app/abi';
import { AbiCoder } from 'ethers';
import { MetricsService } from '@app/common';
import { ContractStandardDetectorService } from './contract-standard-detector.service';
import { NftMetadataService } from './nft-metadata.service';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Injectable()
export class NftTransferDecoderService {
  private readonly logger = new Logger(NftTransferDecoderService.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(NftTransferEntity)
    private readonly nftTransferRepo: Repository<NftTransferEntity>,

    @InjectRepository(Erc721OwnershipEntity)
    private readonly erc721Repo: Repository<Erc721OwnershipEntity>,

    @InjectRepository(Erc1155BalanceEntity)
    private readonly erc1155Repo: Repository<Erc1155BalanceEntity>,

    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
    private readonly standardDetector: ContractStandardDetectorService,
    private readonly nftMetadata: NftMetadataService,
  ) {}

  async decodeBlock(blockNumber: number): Promise<number> {
    const inserts: Partial<NftTransferEntity>[] = [];

    // ── ERC-721: 4-topic Transfer logs ──
    const transferLogs = await this.logRepo.find({
      where: { blockNumber: String(blockNumber), topic0: ERC20_TRANSFER_TOPIC },
      order: { logIndex: 'ASC' },
    });

    for (const log of transferLogs) {
      if (!log.topic1 || !log.topic2 || !log.topic3) continue;

      const classification = await this.standardDetector.classifyTransferLog(log.address, 4);
      if (classification !== 'ERC721') continue;

      try {
        inserts.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          tokenAddress: log.address,
          tokenType: 'ERC721',
          fromAddress: `0x${log.topic1.slice(-40)}`.toLowerCase(),
          toAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
          tokenId: BigInt(log.topic3).toString(),
          quantity: '1',
          operator: null,
        });
      } catch {
        this.logger.warn(`Invalid tokenId in log ${log.transactionHash}:${log.logIndex}`);
      }
    }

    // Persist ERC-721 transfers + update ownership
    const erc721Inserts = [...inserts];
    if (erc721Inserts.length > 0) {
      await this.nftTransferRepo.createQueryBuilder().insert()
        .into(NftTransferEntity).values(erc721Inserts).orIgnore().execute();

      for (const t of erc721Inserts) {
        await this.updateErc721Ownership(t);
      }
    }

    // ── ERC-1155: TransferSingle ──
    const singleLogs = await this.logRepo.find({
      where: { blockNumber: String(blockNumber), topic0: ERC1155_TRANSFER_SINGLE_TOPIC },
      order: { logIndex: 'ASC' },
    });

    for (const log of singleLogs) {
      if (!log.topic1 || !log.topic2 || !log.topic3) continue;
      try {
        const decoded = AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data);
        inserts.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          tokenAddress: log.address,
          tokenType: 'ERC1155',
          fromAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
          toAddress: `0x${log.topic3.slice(-40)}`.toLowerCase(),
          tokenId: decoded[0].toString(),
          quantity: decoded[1].toString(),
          operator: `0x${log.topic1.slice(-40)}`.toLowerCase(),
        });
      } catch {
        this.logger.warn(`Failed ERC-1155 TransferSingle ${log.transactionHash}:${log.logIndex}`);
      }
    }

    // ── ERC-1155: TransferBatch ──
    const batchLogs = await this.logRepo.find({
      where: { blockNumber: String(blockNumber), topic0: ERC1155_TRANSFER_BATCH_TOPIC },
      order: { logIndex: 'ASC' },
    });

    for (const log of batchLogs) {
      if (!log.topic1 || !log.topic2 || !log.topic3) continue;
      try {
        const decoded = AbiCoder.defaultAbiCoder().decode(['uint256[]', 'uint256[]'], log.data);
        const ids: bigint[] = decoded[0];
        const values: bigint[] = decoded[1];
        for (let i = 0; i < ids.length; i++) {
          inserts.push({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex * 1000 + i,
            tokenAddress: log.address,
            tokenType: 'ERC1155',
            fromAddress: `0x${log.topic2.slice(-40)}`.toLowerCase(),
            toAddress: `0x${log.topic3.slice(-40)}`.toLowerCase(),
            tokenId: ids[i].toString(),
            quantity: values[i].toString(),
            operator: `0x${log.topic1.slice(-40)}`.toLowerCase(),
          });
        }
      } catch {
        this.logger.warn(`Failed ERC-1155 TransferBatch ${log.transactionHash}:${log.logIndex}`);
      }
    }

    // Persist ERC-1155 transfers + update balances
    const erc1155Inserts = inserts.slice(erc721Inserts.length);
    if (erc1155Inserts.length > 0) {
      await this.nftTransferRepo.createQueryBuilder().insert()
        .into(NftTransferEntity).values(erc1155Inserts).orIgnore().execute();

      for (const t of erc1155Inserts) {
        await this.updateErc1155Balance(t);
      }
    }

    // Fire-and-forget metadata discovery
    if (inserts.length > 0) {
      const tokenItems = inserts.map((t) => ({
        tokenAddress: t.tokenAddress!, tokenId: t.tokenId!, tokenType: t.tokenType!,
      }));
      this.nftMetadata.ensureBatch(tokenItems).catch((err) => {
        this.logger.warn(`NFT metadata batch error: ${(err as Error).message}`);
      });
    }

    this.metrics.increment('decode.nft_transfers', inserts.length);

    if (inserts.length > 0) {
      this.logger.debug(
        `Block ${blockNumber}: ${erc721Inserts.length} ERC-721 + ${erc1155Inserts.length} ERC-1155 transfers`,
      );
    }

    return inserts.length;
  }

  /**
   * ERC-721: PK is (token_address, token_id) — exactly one owner.
   */
  private async updateErc721Ownership(transfer: Partial<NftTransferEntity>): Promise<void> {
    const { tokenAddress, tokenId, toAddress, blockNumber } = transfer;

    if (toAddress === ZERO_ADDRESS) {
      await this.erc721Repo.delete({ tokenAddress: tokenAddress!, tokenId: tokenId! });
    } else {
      await this.erc721Repo.upsert(
        {
          tokenAddress: tokenAddress!,
          tokenId: tokenId!,
          ownerAddress: toAddress!,
          lastTransferBlock: blockNumber!,
          updatedAt: new Date(),
        },
        ['tokenAddress', 'tokenId'],
      );
    }
  }

  /**
   * ERC-1155: PK is (token_address, token_id, owner_address) — multiple owners.
   */
  private async updateErc1155Balance(transfer: Partial<NftTransferEntity>): Promise<void> {
    const { tokenAddress, tokenId, fromAddress, toAddress, quantity, blockNumber } = transfer;
    const qty = BigInt(quantity!);

    if (fromAddress !== ZERO_ADDRESS) {
      const existing = await this.erc1155Repo.findOne({
        where: { tokenAddress: tokenAddress!, tokenId: tokenId!, ownerAddress: fromAddress! },
      });
      if (existing) {
        const newBal = BigInt(existing.balance) - qty;
        if (newBal <= 0n) {
          await this.erc1155Repo.delete({
            tokenAddress: tokenAddress!, tokenId: tokenId!, ownerAddress: fromAddress!,
          });
        } else {
          await this.erc1155Repo.update(
            { tokenAddress: tokenAddress!, tokenId: tokenId!, ownerAddress: fromAddress! },
            { balance: newBal.toString(), lastTransferBlock: blockNumber!, updatedAt: new Date() },
          );
        }
      }
    }

    if (toAddress !== ZERO_ADDRESS) {
      const existing = await this.erc1155Repo.findOne({
        where: { tokenAddress: tokenAddress!, tokenId: tokenId!, ownerAddress: toAddress! },
      });
      const newBal = existing ? BigInt(existing.balance) + qty : qty;
      await this.erc1155Repo.upsert(
        {
          tokenAddress: tokenAddress!, tokenId: tokenId!, ownerAddress: toAddress!,
          balance: newBal.toString(), lastTransferBlock: blockNumber!, updatedAt: new Date(),
        },
        ['tokenAddress', 'tokenId', 'ownerAddress'],
      );
    }
  }

  /**
   * Recompute ownership/balances after reorg rollback.
   */
  async recomputeAfterRollback(rollbackFrom: number): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "erc721_ownership" WHERE "last_transfer_block" >= $1`,
      [String(rollbackFrom)],
    );
    await this.dataSource.query(`
      INSERT INTO "erc721_ownership" ("token_address", "token_id", "owner_address", "last_transfer_block", "updated_at")
      SELECT DISTINCT ON (nt.token_address, nt.token_id)
        nt.token_address, nt.token_id, nt.to_address, nt.block_number, NOW()
      FROM nft_transfers nt
      WHERE nt.token_type = 'ERC721' AND nt.to_address != $1
      ORDER BY nt.token_address, nt.token_id, nt.block_number DESC, nt.log_index DESC
      ON CONFLICT ("token_address", "token_id") DO UPDATE SET
        owner_address = EXCLUDED.owner_address,
        last_transfer_block = EXCLUDED.last_transfer_block,
        updated_at = NOW()
    `, [ZERO_ADDRESS]);

    await this.dataSource.query(
      `DELETE FROM "erc1155_balances" WHERE "last_transfer_block" >= $1`,
      [String(rollbackFrom)],
    );
  }
}
