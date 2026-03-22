import { ChainProvider } from '@app/chain-provider/chain-provider.interface';
import { BlockDto } from '@app/chain-provider/dto/block.dto';
import { TransactionDto } from '@app/chain-provider/dto/transaction.dto';
import { TransactionReceiptDto } from '@app/chain-provider/dto/transaction-receipt.dto';
import { LogDto } from '@app/chain-provider/dto/log.dto';
import { GetLogsDto } from '@app/chain-provider/dto/get-logs.dto';
import {
  ERC20_TRANSFER_TOPIC,
  ERC1155_TRANSFER_SINGLE_TOPIC,
} from '@app/abi';
import { AbiCoder } from 'ethers';

const UNISWAP_V2_SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
const UNISWAP_V3_SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

/**
 * A test chain provider that generates deterministic, realistic blockchain data.
 * Every block has transactions, receipts, and logs (including ERC-20 transfers).
 */
export class TestChainProvider implements ChainProvider {
  private blocks = new Map<number, BlockDto>();
  private receipts = new Map<string, TransactionReceiptDto>();
  private latestBlock = 100;

  constructor() {
    this.generateBlocks(1, this.latestBlock);
  }

  /**
   * Reset to clean state — regenerate all blocks with correct parent hashes.
   */
  reset(): void {
    this.blocks.clear();
    this.receipts.clear();
    this.latestBlock = 100;
    this.generateBlocks(1, this.latestBlock);
  }

  setLatestBlock(n: number): void {
    if (n > this.latestBlock) {
      this.generateBlocks(this.latestBlock + 1, n);
    }
    this.latestBlock = n;
  }

  /**
   * Replace a block with a different hash (simulates a reorg).
   * The new block has a different hash but keeps the same number.
   * Its parentHash still references the real previous block.
   */
  reorgBlock(blockNumber: number, newHashSuffix = 'ff'): void {
    const existing = this.blocks.get(blockNumber);
    if (!existing) return;

    const newHash = `0x${newHashSuffix.repeat(32)}`.slice(0, 66);
    const reorgedBlock: BlockDto = {
      ...existing,
      hash: newHash,
      // Keep the parent hash pointing to the REAL previous block
      // so the reorg is only at this block number
      transactions: existing.transactions.map((tx, i) => ({
        ...tx,
        hash: `0xreorg${blockNumber.toString(16).padStart(4, '0')}${i.toString(16).padStart(58, '0')}`,
      })),
    };

    this.blocks.set(blockNumber, reorgedBlock);

    // Update receipts for reorged transactions
    for (const tx of reorgedBlock.transactions) {
      this.receipts.set(tx.hash, this.makeReceipt(tx, blockNumber));
    }
  }

  /**
   * Corrupt a block's parent hash to simulate detecting a reorg
   * when the stored block has a hash that doesn't match the chain's view.
   */
  setBlockHash(blockNumber: number, hash: string): void {
    const existing = this.blocks.get(blockNumber);
    if (!existing) return;
    this.blocks.set(blockNumber, { ...existing, hash });
  }

  setBlockParentHash(blockNumber: number, parentHash: string): void {
    const existing = this.blocks.get(blockNumber);
    if (!existing) return;
    this.blocks.set(blockNumber, { ...existing, parentHash });
  }

  getBlock(blockNumber: number): BlockDto | undefined {
    return this.blocks.get(blockNumber);
  }

  // --- ChainProvider interface ---

  async getChainId(): Promise<number> {
    return 1;
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.latestBlock;
  }

  async getBlockByNumber(blockNumber: number): Promise<BlockDto | null> {
    const block = this.blocks.get(blockNumber);
    if (!block) return null;
    return { ...block, transactions: [] };
  }

  async getBlockWithTransactions(blockNumber: number): Promise<BlockDto | null> {
    return this.blocks.get(blockNumber) ?? null;
  }

  async getTransactionReceipt(txHash: string): Promise<TransactionReceiptDto | null> {
    return this.receipts.get(txHash) ?? null;
  }

  async getLogs(params: GetLogsDto): Promise<LogDto[]> {
    const logs: LogDto[] = [];
    for (let bn = params.fromBlock; bn <= params.toBlock; bn++) {
      for (const receipt of this.receipts.values()) {
        if (receipt.blockNumber === bn) {
          logs.push(...receipt.logs);
        }
      }
    }
    return logs;
  }

  // --- Internal generators ---

  private generateBlocks(from: number, to: number): void {
    for (let bn = from; bn <= to; bn++) {
      const prevBlock = this.blocks.get(bn - 1);
      const parentHash = prevBlock
        ? prevBlock.hash
        : `0x${'00'.repeat(32)}`.slice(0, 66);

      const hash = this.blockHash(bn);
      const txCount = (bn % 3) + 1; // 1-3 txs per block
      const transactions: TransactionDto[] = [];

      for (let i = 0; i < txCount; i++) {
        const tx = this.makeTx(bn, i);
        transactions.push(tx);
        this.receipts.set(tx.hash, this.makeReceipt(tx, bn));
      }

      this.blocks.set(bn, {
        number: bn,
        hash,
        parentHash,
        timestamp: 1700000000 + bn * 12,
        nonce: '0x0000000000000000',
        miner: '0x0000000000000000000000000000000000000001',
        difficulty: '0',
        totalDifficulty: null,
        gasLimit: '30000000',
        gasUsed: String(21000 * txCount),
        baseFeePerGas: '1000000000',
        transactions,
      });
    }
  }

  private blockHash(bn: number): string {
    return `0xb${bn.toString(16).padStart(63, '0')}`;
  }

  private makeTx(blockNumber: number, txIndex: number): TransactionDto {
    const from = `0x${(1000 + blockNumber).toString(16).padStart(40, '0')}`;
    const to = `0x${(2000 + txIndex).toString(16).padStart(40, '0')}`;

    return {
      hash: `0x${blockNumber.toString(16).padStart(4, '0')}${txIndex.toString(16).padStart(60, '0')}`,
      blockNumber,
      transactionIndex: txIndex,
      from,
      to,
      value: '1000000000000000000',
      input: '0x',
      nonce: blockNumber,
      gas: '21000',
      gasPrice: '2000000000',
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
      type: 0,
    };
  }

  private makeReceipt(tx: TransactionDto, blockNumber: number): TransactionReceiptDto {
    const hasTransfer = blockNumber % 2 === 0 && tx.transactionIndex === 0;

    const logs: LogDto[] = [];

    if (hasTransfer) {
      // ERC-20 Transfer log
      const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC-like
      const fromPadded = `0x000000000000000000000000${tx.from.slice(2)}`;
      const toPadded = `0x000000000000000000000000${tx.to!.slice(2)}`;
      const amount = BigInt('1000000').toString(16).padStart(64, '0'); // 1 USDC

      logs.push({
        address: tokenAddress,
        blockNumber,
        transactionHash: tx.hash,
        transactionIndex: tx.transactionIndex,
        logIndex: 0,
        data: `0x${amount}`,
        topics: [ERC20_TRANSFER_TOPIC, fromPadded, toPadded],
        removed: false,
      });
    }

    // ERC-721 Transfer log on blocks divisible by 3, tx index 0
    const hasNftTransfer = blockNumber % 3 === 0 && tx.transactionIndex === 0;
    if (hasNftTransfer) {
      const nftAddress = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'; // BAYC-like
      const fromPaddedNft = `0x000000000000000000000000${tx.from.slice(2)}`;
      const toPaddedNft = `0x000000000000000000000000${tx.to!.slice(2)}`;
      const tokenIdHex = `0x${blockNumber.toString(16).padStart(64, '0')}`; // tokenId = blockNumber

      logs.push({
        address: nftAddress,
        blockNumber,
        transactionHash: tx.hash,
        transactionIndex: tx.transactionIndex,
        logIndex: logs.length,
        data: '0x', // ERC-721 Transfer has no data (tokenId is indexed as topic3)
        topics: [ERC20_TRANSFER_TOPIC, fromPaddedNft, toPaddedNft, tokenIdHex],
        removed: false,
      });
    }

    // ERC-1155 TransferSingle log on blocks divisible by 5, tx index 0
    const has1155Transfer = blockNumber % 5 === 0 && tx.transactionIndex === 0;
    if (has1155Transfer) {
      const erc1155Address = '0x76be3b62873462d2142405439777e971754e8e77'; // 1155-like
      const operatorPadded = `0x000000000000000000000000${tx.from.slice(2)}`;
      const fromPadded1155 = `0x000000000000000000000000${tx.from.slice(2)}`;
      const toPadded1155 = `0x000000000000000000000000${tx.to!.slice(2)}`;
      // ABI-encode (tokenId, amount) as data
      const data1155 = AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256'],
        [BigInt(blockNumber * 100), BigInt(10)], // tokenId = blockNumber*100, qty = 10
      );

      logs.push({
        address: erc1155Address,
        blockNumber,
        transactionHash: tx.hash,
        transactionIndex: tx.transactionIndex,
        logIndex: logs.length,
        data: data1155,
        topics: [ERC1155_TRANSFER_SINGLE_TOPIC, operatorPadded, fromPadded1155, toPadded1155],
        removed: false,
      });
    }

    // Uniswap V2 Swap log on blocks divisible by 4, tx index 0
    const hasSwap = blockNumber % 4 === 0 && tx.transactionIndex === 0;
    if (hasSwap) {
      const pairAddress = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc'; // USDC/WETH pair
      const senderPadded = `0x000000000000000000000000${tx.from.slice(2)}`;
      const toPadded = `0x000000000000000000000000${tx.to!.slice(2)}`;
      const swapData = AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256', 'uint256'],
        [BigInt(1000000), BigInt(0), BigInt(0), BigInt('500000000000000000')],
      );

      logs.push({
        address: pairAddress,
        blockNumber,
        transactionHash: tx.hash,
        transactionIndex: tx.transactionIndex,
        logIndex: logs.length,
        data: swapData,
        topics: [UNISWAP_V2_SWAP_TOPIC, senderPadded, toPadded],
        removed: false,
      });
    }

    // Uniswap V3 Swap log on blocks divisible by 7, tx index 0
    const hasV3Swap = blockNumber % 7 === 0 && tx.transactionIndex === 0;
    if (hasV3Swap) {
      const v3PoolAddress = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'; // USDC/WETH 0.05%
      const senderPaddedV3 = `0x000000000000000000000000${tx.from.slice(2)}`;
      const recipientPaddedV3 = `0x000000000000000000000000${tx.to!.slice(2)}`;
      // V3 data: int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick
      // amount0=500000 (positive = user pays USDC), amount1=-250000000000000 (negative = user receives WETH)
      const v3SwapData = AbiCoder.defaultAbiCoder().encode(
        ['int256', 'int256', 'uint160', 'uint128', 'int24'],
        [BigInt(500000), BigInt(-250000000000000), BigInt('1234567890000000000'), BigInt(1000000), -100],
      );

      logs.push({
        address: v3PoolAddress,
        blockNumber,
        transactionHash: tx.hash,
        transactionIndex: tx.transactionIndex,
        logIndex: logs.length,
        data: v3SwapData,
        topics: [UNISWAP_V3_SWAP_TOPIC, senderPaddedV3, recipientPaddedV3],
        removed: false,
      });
    }

    // Always add a non-transfer log too (e.g. an Approval)
    logs.push({
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      blockNumber,
      transactionHash: tx.hash,
      transactionIndex: tx.transactionIndex,
      logIndex: logs.length,
      data: '0x0000000000000000000000000000000000000000000000000000000000000001',
      topics: [
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
        `0x000000000000000000000000${tx.from.slice(2)}`,
        `0x000000000000000000000000${tx.to!.slice(2)}`,
      ],
      removed: false,
    });

    return {
      transactionHash: tx.hash,
      transactionIndex: tx.transactionIndex,
      blockHash: this.blockHash(blockNumber),
      blockNumber,
      from: tx.from,
      to: tx.to,
      contractAddress: null,
      cumulativeGasUsed: '21000',
      gasUsed: '21000',
      effectiveGasPrice: '2000000000',
      status: 1,
      logs,
    };
  }
}
