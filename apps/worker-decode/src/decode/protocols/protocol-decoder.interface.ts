/**
 * Interface for pluggable protocol decoders.
 * Each module decodes protocol-specific events from canonical indexed logs
 * and persists them as derived data.
 *
 * Protocol decoders:
 * - Must be idempotent (re-processing a block produces the same result)
 * - Must be reorg-safe (rollbackFrom deletes affected derived rows)
 * - Must not modify source-of-truth tables (blocks, txs, receipts, logs)
 * - Must be rebuildable from canonical data
 */
export interface ProtocolDecoder {
  /** Unique protocol identifier (e.g. 'UNISWAP_V2') */
  readonly protocol: string;

  /** Decode protocol events for a single block */
  decodeBlock(blockNumber: number): Promise<number>;

  /** Delete derived data for blocks >= blockNumber (reorg safety) */
  rollbackFrom(blockNumber: number): Promise<void>;

  /** Rebuild derived data for a block range (reconciliation) */
  rebuild?(fromBlock: number, toBlock: number): Promise<void>;
}
