# Argus-Core

A self-hosted blockchain indexing platform that syncs Ethereum chain data into Postgres and serves it through a REST API. Decodes ERC-20, ERC-721, and ERC-1155 token events. Built to own your data layer instead of paying per-query API costs.

Start with a hosted RPC (Alchemy, Infura) today and swap to your own node later by changing one environment variable.

## Architecture

```
Blockchain Node / RPC
        |
        v
┌─────────────────┐     ┌──────────────────┐
│  worker-ingest   │────>│   Redis / Bull    │
│  blocks, txs,    │     │   job queues      │
│  receipts, logs  │     └──────┬───────────┘
└─────────────────┘             │
                                v
┌─────────────────┐    ┌──────────────────┐
│ worker-backfill  │    │  worker-decode    │
│ historical sync  │    │  ERC-20/721/1155 │
└────────┬────────┘    │  token metadata   │
         │             └──────┬───────────┘
         v                    v
    ┌──────────────┐ <──── ┌─────────┐
    │   Postgres   │       │   API   │
    └──────────────┘       └─────────┘
```

### Apps

| App               | Role                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `api`             | REST API with Swagger docs — blocks, transactions, addresses, tokens, NFTs, search, admin |
| `worker-ingest`   | Polls for new blocks, syncs blocks + transactions, enqueues receipt/decode jobs           |
| `worker-decode`   | Decodes ERC-20/721/1155 transfer events, fetches token + NFT metadata                     |
| `worker-backfill` | Runs historical backfill jobs with pause/resume, decodes inline                           |

### Shared Libraries

| Lib              | Role                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `chain-provider` | `ChainProvider` interface with RPC + mock implementations (ethers.js)                      |
| `db`             | 18 TypeORM entities, 8 migrations, partition manager, read model + reconciliation services |
| `queue`          | Bull queue module (decode-logs, backfill-range, nft-metadata)                              |
| `abi`            | Event signatures and ABIs for ERC-20, ERC-165, ERC-721, ERC-1155                           |
| `common`         | Address normalization, retry utility, MetricsService                                       |

## Quick Start

### Prerequisites

- Node.js 20+
- Yarn
- Docker and Docker Compose
- An RPC endpoint (Alchemy free tier works)

### Setup

```bash
# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env — set CHAIN_RPC_URL, change DB_HOST and REDIS_HOST to localhost

# Start Postgres and Redis
docker compose up postgres redis -d

# Run database migrations
yarn migration:run

# Start services (each in a separate terminal)
yarn start:dev:api
yarn start:dev:worker-ingest
yarn start:dev:worker-decode
yarn start:dev:worker-backfill
```

Or run everything with Docker Compose:

```bash
docker compose up
```

### Backfill a specific block range

```bash
# Create a backfill job via the API
curl -X POST http://localhost:3000/admin/backfill-jobs \
  -H "Content-Type: application/json" \
  -d '{"fromBlock": 22700000, "toBlock": 22700099, "batchSize": 10}'

# Start the backfill worker
yarn start:dev:worker-backfill

# Monitor progress
curl http://localhost:3000/admin/status | python3 -m json.tool
```

### Mock provider for testing without RPC

Set `CHAIN_PROVIDER_TYPE=mock` in `.env`. The mock provider returns deterministic empty blocks for local development.

## API Endpoints

Swagger docs available at `http://localhost:3000/docs`

### Explorer

| Method | Endpoint                              | Description                                             |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| `GET`  | `/health`                             | Health check                                            |
| `GET`  | `/blocks/latest?limit=25`             | Latest indexed blocks                                   |
| `GET`  | `/blocks/:numberOrHash`               | Block details with transactions                         |
| `GET`  | `/transactions/:hash`                 | Transaction + receipt + logs + token transfers          |
| `GET`  | `/addresses/:address`                 | Address overview with recent activity                   |
| `GET`  | `/addresses/:address/transactions`    | Paginated transaction history                           |
| `GET`  | `/addresses/:address/token-transfers` | Paginated ERC-20 token transfers                        |
| `GET`  | `/addresses/:address/nfts`            | NFTs owned by address (from holdings read model)        |
| `GET`  | `/addresses/:address/nft-transfers`   | Cursor-paginated NFT transfer history                   |
| `GET`  | `/tokens`                             | List indexed ERC-20 token contracts                     |
| `GET`  | `/tokens/:address`                    | Token contract info + recent transfers                  |
| `GET`  | `/tokens/:address/transfers`          | Paginated token transfers                               |
| `GET`  | `/search?q=`                          | Search by tx hash, address, block number, or block hash |

### NFTs

| Method | Endpoint                                               | Description                             |
| ------ | ------------------------------------------------------ | --------------------------------------- |
| `GET`  | `/nfts/collections/:address/transfers`                 | Cursor-paginated collection transfers   |
| `GET`  | `/nfts/collections/:address/tokens/:tokenId`           | Token detail with metadata + owners     |
| `GET`  | `/nfts/collections/:address/tokens/:tokenId/transfers` | Cursor-paginated token transfer history |
| `GET`  | `/nfts/collections/:address/tokens/:tokenId/owners`    | Current token owners                    |

### Admin

| Method  | Endpoint                            | Description                                                |
| ------- | ----------------------------------- | ---------------------------------------------------------- |
| `GET`   | `/admin/status`                     | Indexer status: indexed head, table counts, checkpoints    |
| `GET`   | `/admin/metrics`                    | DB counts, sync state, backfill/reorg stats                |
| `GET`   | `/admin/checkpoints`                | Per-worker sync checkpoints                                |
| `GET`   | `/admin/backfill-jobs`              | All backfill jobs                                          |
| `POST`  | `/admin/backfill-jobs`              | Create a backfill job `{ fromBlock, toBlock, batchSize? }` |
| `PATCH` | `/admin/backfill-jobs/:id/pause`    | Pause a running backfill                                   |
| `PATCH` | `/admin/backfill-jobs/:id/resume`   | Resume a paused backfill                                   |
| `GET`   | `/admin/reorgs?limit=25`            | Recent chain reorganization events                         |
| `POST`  | `/admin/nfts/reconcile?dryRun=true` | Full NFT reconciliation (rebuild + validate)               |
| `POST`  | `/admin/nfts/rebuild-current-state` | Rebuild ownership/balance tables from nft_transfers        |
| `POST`  | `/admin/nfts/rebuild-holdings`      | Rebuild address holdings from current-state tables         |
| `GET`   | `/admin/nfts/validate`              | Validate all NFT derived tables (read-only)                |
| `GET`   | `/admin/nfts/validate/:address`     | Validate one NFT contract                                  |

## Database Schema

### Source of Truth (chain data)

| Table                  | PK                        | Description                                             |
| ---------------------- | ------------------------- | ------------------------------------------------------- |
| `blocks`               | `number`                  | Block headers                                           |
| `transactions`         | `(hash, block_number)`    | Transactions (partitioned)                              |
| `transaction_receipts` | `(tx_hash, block_number)` | Receipts (partitioned)                                  |
| `logs`                 | `id`                      | Event logs (partitioned, unique on tx_hash + log_index) |
| `token_transfers`      | `id`                      | Decoded ERC-20 transfers (partitioned)                  |
| `nft_transfers`        | `id`                      | Decoded ERC-721/1155 transfers (partitioned)            |

### Derived Current State

| Table              | PK                                         | Description                     |
| ------------------ | ------------------------------------------ | ------------------------------- |
| `erc721_ownership` | `(token_address, token_id)`                | Current ERC-721 owner per token |
| `erc1155_balances` | `(token_address, token_id, owner_address)` | Current ERC-1155 balances       |

### Read Models

| Table                  | PK                                   | Description              |
| ---------------------- | ------------------------------------ | ------------------------ |
| `address_nft_holdings` | `(address, token_address, token_id)` | NFTs held per address    |
| `nft_contract_stats`   | `token_address`                      | Collection-level stats   |
| `address_summaries`    | `address`                            | Address activity summary |
| `token_stats`          | `token_address`                      | ERC-20 token stats       |

### Operational

| Table                | PK                          | Description                          |
| -------------------- | --------------------------- | ------------------------------------ |
| `sync_checkpoints`   | `worker_name`               | Per-worker sync progress             |
| `backfill_jobs`      | `id`                        | Historical backfill job state        |
| `reorg_events`       | `id`                        | Chain reorganization audit trail     |
| `token_contracts`    | `address`                   | ERC-20/721/1155 contract metadata    |
| `nft_token_metadata` | `(token_address, token_id)` | NFT metadata cache with fetch status |
| `contract_standards` | `address`                   | Persisted ERC-165 detection results  |

### Data Dependency Model

```
SOURCE OF TRUTH        DERIVED (CURRENT STATE)       DERIVED (READ MODEL)
───────────────        ────────────────────────       ────────────────────
nft_transfers    ──►   erc721_ownership          ──►  address_nft_holdings
                 ──►   erc1155_balances           ──►  nft_contract_stats
```

All derived tables are rebuildable from source-of-truth via `POST /admin/nfts/reconcile`.

## Project Structure

```
blockchain-indexer/
├── apps/
│   ├── api/                        # REST API server
│   │   └── src/
│   │       ├── blocks/             # Block endpoints
│   │       ├── transactions/       # Transaction endpoints
│   │       ├── addresses/          # Address endpoints
│   │       ├── tokens/             # ERC-20 token endpoints
│   │       ├── nfts/               # NFT endpoints
│   │       ├── search/             # Unified search
│   │       ├── admin/              # Admin + reconciliation
│   │       ├── health/             # Health check
│   │       └── common/             # Shared DTOs, pagination, params
│   ├── worker-ingest/              # Real-time block sync
│   ├── worker-decode/              # ERC-20/721/1155 log decoding
│   └── worker-backfill/            # Historical backfill jobs
├── libs/
│   ├── chain-provider/             # RPC abstraction (ethers.js)
│   ├── db/                         # Entities, migrations, services
│   │   └── src/
│   │       ├── entities/           # 18 TypeORM entities
│   │       ├── migrations/         # 8 migrations
│   │       └── services/           # Summary, partition, read model, reconciliation
│   ├── queue/                      # Bull queue configuration
│   ├── abi/                        # Event signatures + ABIs
│   └── common/                     # Metrics, hex utils, retry
├── test/                           # Integration tests (83 tests)
├── docs/                           # Partitioning strategy
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── roadmap.md
└── testing_guide.md
```

## Environment Variables

| Variable                  | Default              | Description                               |
| ------------------------- | -------------------- | ----------------------------------------- |
| `PORT`                    | `3000`               | API server port                           |
| `DB_HOST`                 | `localhost`          | Postgres host (`postgres` inside Docker)  |
| `DB_PORT`                 | `5432`               | Postgres port                             |
| `DB_USERNAME`             | `postgres`           | Postgres user                             |
| `DB_PASSWORD`             | `postgres`           | Postgres password                         |
| `DB_NAME`                 | `blockchain_indexer` | Postgres database name                    |
| `REDIS_HOST`              | `localhost`          | Redis host (`redis` inside Docker)        |
| `REDIS_PORT`              | `6379`               | Redis port                                |
| `CHAIN_RPC_URL`           | —                    | RPC endpoint URL (required for real data) |
| `CHAIN_PROVIDER_TYPE`     | `rpc`                | `rpc` or `mock`                           |
| `INGEST_CONFIRMATIONS`    | `6`                  | Blocks to wait before indexing            |
| `INGEST_BATCH_SIZE`       | `50`                 | Blocks per sync batch                     |
| `INGEST_POLL_INTERVAL_MS` | `5000`               | Polling interval for new blocks           |
| `BACKFILL_BATCH_SIZE`     | `250`                | Blocks per backfill batch                 |
| `START_BLOCK`             | `0`                  | Block number to start syncing from        |

## Key Design Decisions

**Raw first, decode second.** Blocks, transactions, receipts, and logs are stored before any decoding. Decode logic can be changed and replayed from raw data.

**Chain provider is an interface.** Switching from hosted RPC to local node is a config change, not a rewrite.

**Idempotent writes.** All ingestion uses `INSERT ... ON CONFLICT DO NOTHING`. Re-processing a block range produces the same result.

**Checkpoints are mandatory.** Every worker tracks progress. Crashes resume from the last checkpoint.

**Reorg-aware.** The ingest worker validates parent hashes before each sync. Reorgs trigger rollback + re-sync with a full audit trail.

**Source-of-truth separation.** `nft_transfers` is the historical fact table. Ownership, balances, holdings, and stats are derived and rebuildable via the reconciliation service.

**Table partitioning.** `transactions`, `transaction_receipts`, `logs`, `token_transfers`, and `nft_transfers` are partitioned by `block_number` in 1M-block ranges for scalable queries.

**ERC-20 vs ERC-721 disambiguation.** Both share the same `Transfer` event signature. Classification uses topic count (3 = ERC-20, 4 = ERC-721) with ERC-165 `supportsInterface` probing as authoritative override, persisted in `contract_standards`.

## Testing

83 integration tests covering: ingestion, ERC-20 decoding, checkpoint resume, idempotency, backfill lifecycle, search, pagination, reorg detection, metrics, ERC-721 decoding, ERC-1155 decoding, read model population, and reconciliation/drift repair.

```bash
# Prerequisites
docker compose up postgres -d
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer_test;"

# Run all tests
yarn test

# Run integration tests only
yarn test:integration
```

See [testing_guide.md](testing_guide.md) for real-world validation against Ethereum mainnet.

## Scripts

```bash
# Development
yarn start:dev:api
yarn start:dev:worker-ingest
yarn start:dev:worker-decode
yarn start:dev:worker-backfill

# Production
yarn build
yarn start:prod:api
yarn start:prod:worker-ingest
yarn start:prod:worker-decode
yarn start:prod:worker-backfill

# Database
yarn migration:run
yarn migration:revert
yarn migration:generate libs/db/src/migrations/Name

# Testing
yarn test
yarn test:integration
yarn test:cov
yarn lint
```

## Operational Workflows

### After backfill

```bash
# Run NFT reconciliation to guarantee derived table correctness
curl -X POST http://localhost:3000/admin/nfts/reconcile
```

### After reorg

```bash
# Reorgs are handled automatically. Verify NFT state if needed:
curl http://localhost:3000/admin/nfts/validate

# Repair if issues found:
curl -X POST http://localhost:3000/admin/nfts/reconcile
```

## Roadmap

See [roadmap.md](roadmap.md) for the full phased development plan.
