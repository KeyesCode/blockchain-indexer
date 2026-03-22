import { ChainProvider } from '@app/chain-provider/chain-provider.interface';
import { BlockDto } from '@app/chain-provider/dto/block.dto';
import { TransactionDto } from '@app/chain-provider/dto/transaction.dto';
import { TransactionReceiptDto } from '@app/chain-provider/dto/transaction-receipt.dto';
import { LogDto } from '@app/chain-provider/dto/log.dto';
import { GetLogsDto } from '@app/chain-provider/dto/get-logs.dto';
import { ERC20_TRANSFER_TOPIC } from '@app/abi';

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

    // Always add a non-transfer log too (e.g. an Approval)
    logs.push({
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      blockNumber,
      transactionHash: tx.hash,
      transactionIndex: tx.transactionIndex,
      logIndex: hasTransfer ? 1 : 0,
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
