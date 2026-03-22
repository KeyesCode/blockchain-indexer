import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbiCoder } from 'ethers';
import { LogEntity } from '@app/db/entities/log.entity';
import { LendingEventEntity } from '@app/db/entities/lending-event.entity';
import { ProtocolDecoder } from '../protocol-decoder.interface';
import { ProtocolRegistryService } from '../protocol-registry.service';
import {
  COMPOUND_MINT_TOPIC,
  COMPOUND_REDEEM_TOPIC,
  COMPOUND_BORROW_TOPIC,
  COMPOUND_REPAY_TOPIC,
  COMPOUND_LIQUIDATE_TOPIC,
  ALL_COMPOUND_TOPICS,
  PROTOCOL_NAME,
} from './constants';

@Injectable()
export class CompoundDecoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(CompoundDecoder.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(LendingEventEntity)
    private readonly lendingRepo: Repository<LendingEventEntity>,

    private readonly registry: ProtocolRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: ALL_COMPOUND_TOPICS.map((topic) => ({
        blockNumber: String(blockNumber),
        topic0: topic,
      })),
      order: { logIndex: 'ASC' },
    });

    if (logs.length === 0) return 0;

    const inserts: Partial<LendingEventEntity>[] = [];

    for (const log of logs) {
      try {
        const event = this.decodeLog(log);
        if (event) inserts.push(event);
      } catch {
        this.logger.debug(`Skipping non-Compound event ${log.transactionHash}:${log.logIndex}`);
      }
    }

    if (inserts.length > 0) {
      await this.lendingRepo
        .createQueryBuilder()
        .insert()
        .into(LendingEventEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      this.logger.debug(`Block ${blockNumber}: decoded ${inserts.length} Compound events`);
    }

    return inserts.length;
  }

  async rollbackFrom(blockNumber: number): Promise<void> {
    await this.lendingRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :bn AND "protocol_name" = :proto', {
        bn: String(blockNumber),
        proto: PROTOCOL_NAME,
      })
      .execute();
  }

  private decodeLog(log: LogEntity): Partial<LendingEventEntity> | null {
    const base = {
      protocolName: PROTOCOL_NAME,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      // Compound events emit from the cToken contract — that's the asset
      assetAddress: log.address,
      rateMode: null,
      borrowRate: null,
      collateralAsset: null,
      debtToCover: null,
      liquidatedCollateral: null,
      liquidatorAddress: null,
      onBehalfOf: null,
    };

    switch (log.topic0) {
      case COMPOUND_MINT_TOPIC:
        return this.decodeMint(log, base);
      case COMPOUND_REDEEM_TOPIC:
        return this.decodeRedeem(log, base);
      case COMPOUND_BORROW_TOPIC:
        return this.decodeBorrow(log, base);
      case COMPOUND_REPAY_TOPIC:
        return this.decodeRepay(log, base);
      case COMPOUND_LIQUIDATE_TOPIC:
        return this.decodeLiquidate(log, base);
      default:
        return null;
    }
  }

  /** Returns byte length of hex data string (e.g. "0x..." → number of bytes) */
  private dataBytes(data: string): number {
    return data.startsWith('0x') ? (data.length - 2) / 2 : data.length / 2;
  }

  /**
   * Mint(address minter, uint256 mintAmount, uint256 mintTokens)
   * All in data, no indexed params beyond topic0.
   * Expected data: 3 slots = 96 bytes.
   */
  private decodeMint(log: LogEntity, base: any): Partial<LendingEventEntity> | null {
    if (this.dataBytes(log.data) < 96) return null; // not a Compound Mint
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint256', 'uint256'],
      log.data,
    );
    return {
      ...base,
      eventType: 'DEPOSIT',
      userAddress: (decoded[0] as string).toLowerCase(),
      amount: decoded[1].toString(),
    };
  }

  /**
   * Redeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens)
   * Expected data: 3 slots = 96 bytes.
   */
  private decodeRedeem(log: LogEntity, base: any): Partial<LendingEventEntity> | null {
    if (this.dataBytes(log.data) < 96) return null;
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint256', 'uint256'],
      log.data,
    );
    return {
      ...base,
      eventType: 'WITHDRAW',
      userAddress: (decoded[0] as string).toLowerCase(),
      amount: decoded[1].toString(),
    };
  }

  /**
   * Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)
   * Expected data: 4 slots = 128 bytes.
   */
  private decodeBorrow(log: LogEntity, base: any): Partial<LendingEventEntity> | null {
    if (this.dataBytes(log.data) < 128) return null;
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint256', 'uint256', 'uint256'],
      log.data,
    );
    return {
      ...base,
      eventType: 'BORROW',
      userAddress: (decoded[0] as string).toLowerCase(),
      amount: decoded[1].toString(),
    };
  }

  /**
   * RepayBorrow(address payer, address borrower, uint256 repayAmount, uint256 accountBorrows, uint256 totalBorrows)
   * Expected data: 5 slots = 160 bytes.
   */
  private decodeRepay(log: LogEntity, base: any): Partial<LendingEventEntity> | null {
    if (this.dataBytes(log.data) < 160) return null;
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'address', 'uint256', 'uint256', 'uint256'],
      log.data,
    );
    return {
      ...base,
      eventType: 'REPAY',
      userAddress: (decoded[1] as string).toLowerCase(),
      onBehalfOf: (decoded[0] as string).toLowerCase(),
      amount: decoded[2].toString(),
    };
  }

  /**
   * LiquidateBorrow(address liquidator, address borrower, uint256 repayAmount, address cTokenCollateral, uint256 seizeTokens)
   * Expected data: 5 slots = 160 bytes.
   */
  private decodeLiquidate(log: LogEntity, base: any): Partial<LendingEventEntity> | null {
    if (this.dataBytes(log.data) < 160) return null;
    const decoded = AbiCoder.defaultAbiCoder().decode(
      ['address', 'address', 'uint256', 'address', 'uint256'],
      log.data,
    );
    return {
      ...base,
      eventType: 'LIQUIDATION',
      liquidatorAddress: (decoded[0] as string).toLowerCase(),
      userAddress: (decoded[1] as string).toLowerCase(),
      amount: decoded[2].toString(),
      debtToCover: decoded[2].toString(),
      collateralAsset: (decoded[3] as string).toLowerCase(),
      liquidatedCollateral: decoded[4].toString(),
    };
  }
}
