# ROADMAP.md

## 📌 Project: Blockchain Indexer

---

## 🧭 Vision

Build a reusable, production-grade blockchain indexing platform that provides:

- Canonical on-chain data (source of truth)
- Derived protocol-level insights (modular & extensible)
- High-performance APIs for downstream applications

This repo is NOT an intelligence system (Argus).  
This is the data foundation layer.

---

## 🧱 Architecture Overview

### Core Principle

Separate:

- Truth Layer (Core Indexer) → raw, canonical blockchain data
- Derived Layer (Protocol Modules) → decoded, interpretable events

---

## 🏗️ System Layers

### 1. Core Indexer Layer (Always Present)

Responsible for:

- Block ingestion
- Transactions & receipts
- Logs
- ERC-20 transfers
- ERC-721 ownership
- ERC-1155 balances
- Data integrity & reconciliation
- Read models
- Public API

---

### 2. Protocol Decoder Layer (Modular & Pluggable)

Responsible for:

- DEX swaps
- Lending activity
- NFT marketplace events
- Bridges / cross-chain
- Vault interactions
- Custom contracts

---

## 🔑 Design Principles

### 1. Truth vs Derived Data

Primary Truth (Immutable / Canonical):

- Blocks
- Transactions
- Logs
- Token transfers

Derived Data (Rebuildable):

- Swaps
- Lending events
- NFT sales
- Bridge activity

Protocol data must ALWAYS be:

- Rebuildable
- Reorg-safe
- Decoupled from ingestion

---

### 2. Modularity

- Protocol logic must NOT live in core ingestion
- Each protocol = isolated module
- No tight coupling between protocols

---

### 3. Replayability

The system must support:

- Backfills
- Reorg handling
- Full rebuilds

---

### 4. Performance First

- Partition large tables early
- Optimize queries continuously
- Avoid unnecessary joins in APIs

---

## 📁 Suggested Project Structure

apps/
api/
worker-ingest/
worker-decode/
worker-backfill/

libs/
db/
shared/
chain/
erc20/
nft/
protocols/
common/
uniswap-v2/
uniswap-v3/
aave/

---

## ⚙️ Core System Roadmap

---

### Phase 1 — Foundation (CURRENT)

Status: In Progress / Near Completion

Goals:

- Reliable ingestion pipeline
- Data correctness
- Idempotency
- Partitioning strategy

Work Items:

- [x] Block ingestion pipeline
- [x] Transactions + receipts
- [x] Logs ingestion
- [x] ERC-20 transfer decoding
- [x] ERC-721 ownership model (erc721_ownership)
- [x] ERC-1155 balances (erc1155_balances)
- [x] Backfill system with checkpoints
- [x] Idempotent processing
- [x] Partitioned tables (block_number range)
- [x] Partition manager service

Remaining:

- [ ] Query performance optimization (EXPLAIN ANALYZE)
- [ ] Composite indexes:
  - (from_address, block_number DESC)
  - (to_address, block_number DESC)
  - (token_address, block_number DESC)
- [ ] Read model optimization

---

### Phase 2 — Protocol Framework (NEXT)

Goals:

- Introduce protocol decoding layer
- Keep core indexer clean
- Enable extensibility

Work Items:

- [ ] Create ProtocolDecoder interface

interface ProtocolDecoder {
protocol: string;
canHandle(logsOrTx: unknown): Promise<boolean>;
decodeBlock(blockNumber: number): Promise<void>;
reconcile?(fromBlock?: number, toBlock?: number): Promise<void>;
}

- [ ] Build protocol registry system:
  - protocol name
  - contract addresses
  - contract type
  - chain id

- [ ] Create protocol worker (worker-decode)
- [ ] Add protocol event tables:
  - dex_swaps
  - lending_events
  - nft_sales
- [ ] Implement replay/rebuild support

---

### Phase 3 — Tier 1 Protocols (HIGH ROI)

Goals:
Cover ~80–90% of real-world use cases

---

Uniswap V2:

- [ ] Pair detection
- [ ] Swap decoding
- [ ] Mint / Burn events
- [ ] Normalize trades

---

ERC-20 Approvals:

- [ ] Approval event decoding
- [ ] Allowance tracking

Enables:

- Wallet security insights
- Token permission tracking

---

Uniswap V3:

- [ ] Swap decoding
- [ ] Liquidity positions
- [ ] Fee collection

---

NFT Marketplaces (Seaport / Blur):

- [ ] Order fulfillment decoding
- [ ] Sale normalization

---

### Phase 4 — Tier 2 Protocols

Lending:

Aave:

- [ ] Deposit / Withdraw
- [ ] Borrow / Repay
- [ ] Liquidations

Compound:

- [ ] Mint / Redeem
- [ ] Borrow / Repay

---

ERC-4626 Vaults:

- [ ] Deposit / Withdraw

---

Bridges:

- [ ] LayerZero
- [ ] Hop
- [ ] Stargate
- [ ] Native L2 bridges

Enables:

- Cross-chain tracking
- Flow analytics

---

### Phase 5 — Advanced Protocols

Curve:

- [ ] Swaps
- [ ] Liquidity events

Balancer:

- [ ] Multi-token pool support

GMX (Perps):

- [ ] Position lifecycle
- [ ] Liquidations

ENS:

- [ ] Name registration
- [ ] Transfers

---

### Phase 6 — Meta / Infrastructure Protocols

Aggregators:

- [ ] 1inch
- [ ] 0x
- [ ] Paraswap

Note: Requires multi-call reconstruction

---

Safe (Gnosis Safe):

- [ ] Transaction execution
- [ ] Module interactions

---

ERC-4337:

- [ ] UserOperation decoding

---

## ⚠️ Out of Scope (Handled by Argus)

Do NOT include:

- Wallet intelligence scoring
- Smart money detection
- Alerting systems
- Trading strategies
- Machine learning models
- Cross-wallet behavioral analysis

---

## 🔥 Implementation Strategy

Start with event-driven protocols:

Easy:

- Uniswap V2
- ERC-4626
- Compound

Medium:

- Uniswap V3
- Seaport
- Aave

Hard:

- Aggregators
- Router-based swaps

---

## 📈 Performance & Scaling Strategy

- Partition by block_number
- Pre-create partitions
- Use composite indexes
- Avoid full-table scans
- Optimize read models
- Minimize joins in hot paths

---

## 🏁 Final Execution Order

1. Core stability (polish Phase 1)
2. Protocol framework
3. Uniswap V2 + Approvals
4. Uniswap V3
5. NFT marketplaces
6. Lending
7. Bridges
8. Advanced protocols

---

## 🧠 Final Summary

Build:

Core Indexer + Modular Protocol Decoders

NOT:

Monolithic Intelligence System

---

This ensures:

- Reusability across projects
- Clean architecture
- Scalable performance
- Future-proof extensibility
