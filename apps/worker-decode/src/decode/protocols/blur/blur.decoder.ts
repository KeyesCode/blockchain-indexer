import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbiCoder } from 'ethers';
import { LogEntity } from '@app/db/entities/log.entity';
import { NftSaleEntity } from '@app/db/entities/nft-sale.entity';
import { ProtocolDecoder } from '../protocol-decoder.interface';
import { ProtocolRegistryService } from '../protocol-registry.service';
import {
  BLUR_ORDERS_MATCHED_TOPIC,
  ORDER_TUPLE,
  INPUT_TUPLE,
  PROTOCOL_NAME,
} from './constants';

const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

@Injectable()
export class BlurDecoder implements ProtocolDecoder, OnModuleInit {
  readonly protocol = PROTOCOL_NAME;
  private readonly logger = new Logger(BlurDecoder.name);

  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepo: Repository<LogEntity>,

    @InjectRepository(NftSaleEntity)
    private readonly saleRepo: Repository<NftSaleEntity>,

    private readonly registry: ProtocolRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async decodeBlock(blockNumber: number): Promise<number> {
    const logs = await this.logRepo.find({
      where: {
        blockNumber: String(blockNumber),
        topic0: BLUR_ORDERS_MATCHED_TOPIC,
      },
      order: { logIndex: 'ASC' },
    });

    if (logs.length === 0) return 0;

    const inserts: Partial<NftSaleEntity>[] = [];

    for (const log of logs) {
      try {
        const sale = this.decodeOrdersMatched(log);
        if (sale) inserts.push(sale);
      } catch {
        this.logger.warn(
          `Failed to decode Blur OrdersMatched ${log.transactionHash}:${log.logIndex}`,
        );
      }
    }

    if (inserts.length > 0) {
      await this.saleRepo
        .createQueryBuilder()
        .insert()
        .into(NftSaleEntity)
        .values(inserts)
        .orIgnore()
        .execute();

      this.logger.debug(
        `Block ${blockNumber}: decoded ${inserts.length} Blur sales`,
      );
    }

    return inserts.length;
  }

  async rollbackFrom(blockNumber: number): Promise<void> {
    await this.saleRepo
      .createQueryBuilder()
      .delete()
      .where('"block_number" >= :bn AND "protocol_name" = :proto', {
        bn: String(blockNumber),
        proto: PROTOCOL_NAME,
      })
      .execute();
  }

  /**
   * Decode OrdersMatched event.
   * Topics: [sig, maker, taker]
   * Data: [sell Order, sell Input, buy Order, buy Input]
   *
   * The sell order has side=1 and contains the NFT details.
   * The buy order has side=0 and contains the price.
   */
  private decodeOrdersMatched(log: LogEntity): Partial<NftSaleEntity> | null {
    if (!log.topic1 || !log.topic2) return null;

    const maker = `0x${log.topic1.slice(-40)}`.toLowerCase();
    const taker = `0x${log.topic2.slice(-40)}`.toLowerCase();

    const decoded = AbiCoder.defaultAbiCoder().decode(
      [ORDER_TUPLE, INPUT_TUPLE, ORDER_TUPLE, INPUT_TUPLE],
      log.data,
    );

    const sellOrder = decoded[0];
    const buyOrder = decoded[2];

    // Determine which order is the sell (side=1) and which is buy (side=0)
    const sell = Number(sellOrder[1]) === 1 ? sellOrder : buyOrder;
    const buy = Number(buyOrder[1]) === 0 ? buyOrder : sellOrder;

    const collection = (sell[3] as string).toLowerCase(); // collection
    const tokenId = (sell[4] as bigint).toString(); // tokenId
    const amount = sell[5] as bigint; // amount (usually 1 for ERC-721)
    const price = buy[7] as bigint; // price from buy order
    const paymentToken = (buy[6] as string).toLowerCase(); // paymentToken

    // Determine seller and buyer
    // maker = the one who created the first order
    // taker = the one who matched it
    // If sell.trader == maker, maker is selling
    const sellTrader = (sell[0] as string).toLowerCase();
    const seller = sellTrader === maker ? maker : taker;
    const buyer = seller === maker ? taker : maker;

    return {
      protocolName: PROTOCOL_NAME,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      orderHash: null,
      collectionAddress: collection,
      tokenId,
      tokenStandard: 'ERC721',
      quantity: amount.toString(),
      sellerAddress: seller,
      buyerAddress: buyer,
      paymentToken: paymentToken === ETH_ADDRESS ? ETH_ADDRESS : paymentToken,
      totalPrice: price.toString(),
    };
  }
}
