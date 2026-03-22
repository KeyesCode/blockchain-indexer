# Roadmap

## Vision

Build a reusable, production-grade blockchain indexing platform that provides:

- Canonical on-chain data (source of truth)
- Derived protocol-level insights (modular & extensible)
- High-performance APIs for downstream applications

This repo is NOT an intelligence system (Argus).
This is the data foundation layer.

---

## Architecture

### Core Principle

Separate:

- **Truth Layer** (Core Indexer) — raw, canonical blockchain data
- **Derived Layer** (Protocol Modules) — decoded, interpretable events

### System Layers

**1. Core Indexer Layer (Always Present)**
- Block ingestion
- Transactions & receipts
- Logs
- ERC-20 transfers
- ERC-721 ownership
- ERC-1155 balances
- NFT metadata pipeline
- Data integrity & reconciliation
- Read models (holdings, stats, summaries)
- Public API with Swagger docs

**2. Protocol Decoder Layer (Modular & Pluggable)**
- DEX swaps (Uniswap V2 implemented)
- Lending activity
- NFT marketplace events
- Bridges / cross-chain
- Vault interactions
- Custom contracts

---

## Design Principles

1. **Truth vs Derived** — protocol data is always rebuildable, reorg-safe, and decoupled from ingestion
2. **Modularity** — each protocol is an isolated module implementing `ProtocolDecoder` interface
3. **Replayability** — backfills, reorg handling, and full rebuilds supported
4. **Performance First** — partition large tables, composite indexes, cursor pagination, read models

---

## Phase 1 — Foundation

**Status: COMPLETE**

- [x] Block ingestion pipeline
- [x] Transactions + receipts
- [x] Logs ingestion
- [x] ERC-20 transfer decoding
- [x] Token metadata discovery (name, symbol, decimals via RPC)
- [x] Checkpoint-based resumable sync
- [x] Confirmation depth (default 6 blocks)
- [x] Idempotent processing (INSERT ON CONFLICT DO NOTHING)
- [x] Backfill system with pause/resume/progress tracking
- [x] Reorg detection (parent hash validation) + rollback + audit trail
- [x] Partitioned tables (transactions, receipts, logs, token_transfers, nft_transfers)
- [x] Partition manager service (auto-creates partitions ahead of sync)
- [x] Composite indexes for address lookups (from_address, to_address + block_number DESC)
- [x] Read models: address_summaries, token_stats
- [x] MetricsService (counters, gauges, rate tracking, error recording)
- [x] Admin status/metrics/checkpoints/reorgs endpoints
- [x] Search endpoint (tx hash, block number/hash, address)
- [x] Response DTOs with Swagger decorators
- [x] Validation pipes (class-validator/class-transformer)
- [x] Feature-based NestJS module organization
- [x] 87 integration + unit tests

---

## Phase 2 — NFT Support

**Status: COMPLETE**

### ERC-721
- [x] Transfer decoding (4-topic Transfer logs)
- [x] Contract standard detection (ERC-165 supportsInterface probing)
- [x] Contract standard persistence (contract_standards table)
- [x] erc721_ownership table — PK (token_address, token_id), exactly one owner
- [x] Ownership updates: mint/transfer/burn
- [x] Reorg-safe rollback of ownership

### ERC-1155
- [x] TransferSingle decoding (ABI decode from data field)
- [x] TransferBatch decoding (expand arrays into individual rows)
- [x] erc1155_balances table — PK (token_address, token_id, owner_address)
- [x] Balance tracking: increment/decrement with quantity
- [x] Burn: delete row when balance reaches 0

### NFT Metadata
- [x] nft_token_metadata table with fetch status (PENDING/FETCHING/SUCCESS/FAILED/RETRYABLE)
- [x] NftMetadataService — tokenURI fetch, IPFS/Arweave/data URI normalization
- [x] Queue-backed metadata worker (Bull NFT_METADATA queue)
- [x] Fire-and-forget from decoder — never blocks ingestion

### NFT Read Models
- [x] address_nft_holdings — fast lookup of NFTs held by address
- [x] nft_contract_stats — collection-level transfer counts, holder counts
- [x] Incremental updates during decode/backfill
- [x] Cursor pagination on all NFT transfer history endpoints

### NFT Reconciliation
- [x] NftReconciliationService — validate + rebuild all derived tables
- [x] Rebuild order: nft_transfers → ownership/balances → holdings → stats
- [x] Admin endpoints: POST /admin/nfts/reconcile, GET /admin/nfts/validate
- [x] Drift detection: ownership mismatches, holdings gaps, stats errors
- [x] dryRun mode for validation without mutation

### NFT API
- [x] GET /nfts/collections/:address/transfers (cursor paginated)
- [x] GET /nfts/collections/:address/tokens/:tokenId (metadata + owners)
- [x] GET /nfts/collections/:address/tokens/:tokenId/transfers
- [x] GET /nfts/collections/:address/tokens/:tokenId/owners
- [x] GET /addresses/:address/nfts (from holdings read model)
- [x] GET /addresses/:address/nft-transfers (cursor paginated)

---

## Phase 3 — Protocol Decoder Framework

**Status: COMPLETE**

- [x] ProtocolDecoder interface (decodeBlock, rollbackFrom, rebuild)
- [x] ProtocolRegistryService (register, decodeBlock, rollbackFrom)
- [x] Self-registration via onModuleInit
- [x] protocol_contracts table (cross-protocol contract registry)
- [x] dex_pairs table (pair metadata: token0, token1, factory)
- [x] dex_swaps table (normalized swap events)
- [x] Integrated into decode worker queue processor
- [x] Integrated into backfill runner (inline decode)
- [x] Reorg rollback for protocol-derived tables
- [x] Protocol API: GET /protocols/dex/swaps, /pairs, /addresses/:address/dex-swaps

### Uniswap V2
- [x] Swap event decoding (topic0 = 0xd78ad95f...)
- [x] Pair detection: memory cache → DB → RPC probe (token0/token1/factory)
- [x] Persistence in dex_swaps + dex_pairs + protocol_contracts
- [x] Idempotent (orIgnore on unique tx_hash + log_index)
- [ ] Mint / Burn (LP) events
- [ ] Sync event for reserve tracking

---

## Phase 4 — Tier 1 Protocols

### ERC-20 Approvals — COMPLETE
- [x] Approval(address indexed owner, address indexed spender, uint256 value) decoding
- [x] token_approvals table (historical events, unique on tx_hash + log_index)
- [x] token_allowances_current table — PK (token_address, owner_address, spender_address)
- [x] Erc20ApprovalDecoderService — 3-topic Approval logs, value in data
- [x] Inline decode in backfill runner
- [x] Reorg rollback for approvals + allowances
- [x] API: GET /tokens/:address/allowance/:owner/:spender
- [x] API: GET /addresses/:address/approvals (paginated history)
- [x] API: GET /addresses/:address/allowances (current state)

### Uniswap V3 — COMPLETE
- [x] Swap(address,address,int256,int256,uint160,uint128,int24) decoding
- [x] Pool detection: memory cache → DB (dex_pairs) → RPC probe (token0/token1/fee/factory)
- [x] Reuse dex_swaps with protocol_name = UNISWAP_V3
- [x] Signed amount mapping: positive → amountIn, negative → amountOut
- [x] Self-registering via ProtocolDecoder + onModuleInit
- [x] Inline decode in backfill runner
- [x] Idempotent (orIgnore on unique tx_hash + log_index)
- [ ] Liquidity position tracking (optional, future)

### NFT Marketplaces — COMPLETE

**Seaport (OpenSea):**
- [x] OrderFulfilled event decoding (nested SpentItem/ReceivedItem struct arrays)
- [x] nft_sales table (collection, tokenId, seller, buyer, paymentToken, totalPrice)
- [x] Sale direction detection: offer NFT + consideration ETH/ERC20 = sell, vice versa = buy
- [x] Price extraction: sum consideration payments to seller

**Blur:**
- [x] OrdersMatched event decoding (nested Order/Input struct pairs)
- [x] Reuses nft_sales table with protocol_name = BLUR
- [x] Seller/buyer determination from sell/buy order sides + maker/taker roles

**Shared:**
- [x] Self-registering via ProtocolDecoder + onModuleInit
- [x] Reorg rollback for both protocols
- [x] API: GET /nfts/collections/:address/sales (cursor paginated)
- [x] API: GET /addresses/:address/nft-sales (cursor paginated)

---

## Phase 5 — Tier 2 Protocols

### Lending: Aave — COMPLETE
- [x] lending_events table (generic, reusable for Compound/Aave/etc.)
- [x] AaveDecoder — Deposit/Supply, Withdraw, Borrow, Repay, LiquidationCall
- [x] Supports both Aave V2 (Deposit) and V3 (Supply) event signatures
- [x] Liquidation decoding with collateralAsset, debtToCover, liquidatedCollateral, liquidator
- [x] Self-registering via ProtocolDecoder + onModuleInit
- [x] Inline in backfill via protocol registry
- [x] Reorg rollback
- [x] API: GET /protocols/lending/events?protocolName=&eventType=&assetAddress= (cursor paginated)
- [x] API: GET /addresses/:address/lending (cursor paginated)

### Lending: Compound — COMPLETE
- [x] CompoundDecoder — Mint (→DEPOSIT), Redeem (→WITHDRAW), Borrow, RepayBorrow, LiquidateBorrow
- [x] Reuses lending_events table with protocol_name = COMPOUND
- [x] Compound events use non-indexed params (all in data) — different decode pattern from Aave
- [x] Self-registering, backfill-integrated, reorg-safe

### ERC-4626 Vaults
- [ ] Deposit / Withdraw

### Bridges
- [ ] LayerZero
- [ ] Hop
- [ ] Stargate
- [ ] Native L2 bridges

---

## Phase 6 — Advanced Protocols

### Curve
- [ ] Swaps
- [ ] Liquidity events

### Balancer
- [ ] Multi-token pool support

### GMX (Perps)
- [ ] Position lifecycle
- [ ] Liquidations

### ENS
- [ ] Name registration
- [ ] Transfers

---

## Phase 7 — Meta / Infrastructure

### Aggregators
- [ ] 1inch
- [ ] 0x
- [ ] Paraswap
Note: Requires multi-call reconstruction

### Safe (Gnosis Safe)
- [ ] Transaction execution
- [ ] Module interactions

### ERC-4337
- [ ] UserOperation decoding

---

## Future Infrastructure

### Multi-chain support
- [ ] Chain-aware entity design (chain_id column or separate schemas)
- [ ] Multiple chain provider instances
- [ ] Per-chain workers and checkpoints

### Internal transactions / traces
- [ ] debug_traceBlockByNumber or trace_block
- [ ] internal_transactions table
- [ ] Requires archive node

### Contract verification
- [ ] Store verified contract ABIs
- [ ] Auto-decode all events for verified contracts

### Frontend explorer
- [ ] Next.js frontend
- [ ] Block, transaction, address, token, NFT pages
- [ ] Real-time updates via WebSocket

---

## Out of Scope (Handled by Argus)

Do NOT include:

- Wallet intelligence scoring
- Smart money detection
- Alerting systems
- Trading strategies
- Machine learning models
- Cross-wallet behavioral analysis

---

## Implementation Priority

| Difficulty | Protocols |
|---|---|
| Easy | ~~ERC-20 Approvals~~, ERC-4626 |
| Medium | ~~Uniswap V3~~, ~~Seaport~~, ~~Aave~~ |
| Hard | Aggregators, Router-based swaps |

---

## Execution Order

1. ~~Core stability (Phase 1)~~ DONE
2. ~~NFT support (Phase 2)~~ DONE
3. ~~Protocol framework + Uniswap V2 (Phase 3)~~ DONE
4. ~~ERC-20 Approvals + Uniswap V3~~ DONE
5. ~~NFT marketplaces (Seaport + Blur)~~ DONE
6. ~~Lending: Aave + Compound~~ DONE
7. **ERC-4626 Vaults** ← NEXT
8. Advanced protocols
