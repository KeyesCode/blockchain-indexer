# Testing Guide

## Automated Tests

83 integration + unit tests covering ingestion, decoding, checkpoints, idempotency, backfill, search, pagination, reorg detection, metrics, ERC-721/1155 decoding, NFT read models, and reconciliation/drift repair.

### Prerequisites

- Docker running (for Postgres)
- Node dependencies installed (`yarn install`)

### Setup

```bash
# Start Postgres
docker compose up postgres -d

# Create the test database (one-time)
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer_test;"

# Run all tests
yarn test

# Run integration tests only (sequential, with forced exit)
yarn test:integration
```

### Test categories

| Category | Tests | What's covered |
|----------|-------|----------------|
| Block ingestion | 5 | Blocks, txs, parent hash chain, normalization, queue integration |
| ERC-20 decoding | 2 | Transfer events decoded, non-Transfer logs skipped |
| Checkpoint resume | 3 | Created, resumes correctly, per-block granularity |
| Idempotency | 5 | No duplicates for blocks, txs, receipts, logs, transfers |
| Backfill lifecycle | 4 | Create, run, pause/resume, multi-batch completion |
| Search | 5 | Block by number/hash, tx hash, address, unknown query |
| API pagination | 6 | Limit/offset, max limit, token transfers, blocks, tx detail |
| Reorg detection | 7 | No false positive, detection, rollback, checkpoint reset, audit, re-sync |
| Metrics | 3 | Counters, gauges, rate tracking |
| ERC-721 decoding | 6 | Decode, no misclassification, ownership, mint, idempotency, reorg |
| ERC-1155 decoding | 4 | TransferSingle, balances, idempotency, address separation |
| NFT read models | 4 | Holdings for ERC-721/1155, contract stats, ownership consistency |
| Reconciliation | 8 | Validate clean state, detect drift, rebuild ownership/holdings/stats, fullReconcile, dryRun |
| Pagination DTOs | 7 | Defaults, transform, max/min bounds, negative offset |
| Search classification | 8 | Query routing, lowercase, hex rejection, match returns |
| Admin state transitions | 6 | Job creation, defaults, pause/resume, string storage |

### Test infrastructure

- **`TestChainProvider`** — deterministic mock generating blocks with ERC-20 Transfer logs (even blocks), ERC-721 Transfer logs (blocks % 3), and ERC-1155 TransferSingle logs (blocks % 5)
- **Real Postgres** — tests run against `blockchain_indexer_test` with `synchronize: true` (tables created from entities, no migrations needed)
- **MockQueue** — in-memory Bull queue substitute, captures enqueued jobs for assertions
- **Full isolation** — every test truncates all tables and resets chain provider state

---

## Real-World Validation

Test the full pipeline against Ethereum mainnet using a real RPC endpoint.

### Step 1: Get an RPC endpoint

Sign up for Alchemy (free tier: 300M compute units/month). Create an Ethereum Mainnet app and copy the HTTP URL.

### Step 2: Pick a block range

Use a recent range — early blocks are mostly empty. A recent 100-block window contains ~10,000-20,000 transactions with hundreds of ERC-20 transfers and NFT events.

```
fromBlock: 22700000
toBlock:   22700099
```

### Step 3: Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=blockchain_indexer

REDIS_HOST=localhost
REDIS_PORT=6379

CHAIN_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY_HERE
CHAIN_PROVIDER_TYPE=rpc

START_BLOCK=22700000
INGEST_BATCH_SIZE=10
INGEST_CONFIRMATIONS=0
INGEST_POLL_INTERVAL_MS=5000
BACKFILL_BATCH_SIZE=10
```

`DB_HOST` and `REDIS_HOST` must be `localhost` when running apps directly on your machine. Use `postgres` / `redis` only inside Docker Compose.

### Step 4: Start infrastructure

```bash
docker compose up postgres redis -d
yarn migration:run
```

### Step 5: Start the API

Terminal 1:

```bash
yarn start:dev:api
```

Swagger docs available at `http://localhost:3000/docs`.

### Step 6: Create a backfill job

```bash
curl -X POST http://localhost:3000/admin/backfill-jobs \
  -H "Content-Type: application/json" \
  -d '{"fromBlock": 22700000, "toBlock": 22700099, "batchSize": 10}'
```

### Step 7: Start the backfill worker

Terminal 2:

```bash
yarn start:dev:worker-backfill
```

The backfill worker does everything in one pass — blocks, transactions, receipts, logs, ERC-20 transfers, ERC-721/1155 transfers, ownership updates, holdings, and contract stats.

Watch for progress:

```
[BackfillRunnerService] Starting backfill job #1: 22700000 -> 22700099 (batch=10)
[BackfillRunnerService] Job #1: synced through block 22700009 (10%)
...
[BackfillJobService] Backfill job #1 completed
```

### Step 8: Monitor progress

```bash
curl http://localhost:3000/admin/status | python3 -m json.tool
```

### Step 9: Run NFT reconciliation

After backfill completes, verify all derived tables are correct:

```bash
# Validate only (no writes)
curl http://localhost:3000/admin/nfts/validate | python3 -m json.tool

# Full rebuild + validate if issues found
curl -X POST http://localhost:3000/admin/nfts/reconcile | python3 -m json.tool
```

The reconciliation report shows:
- How many contracts/tokens were checked
- Any drift detected (ownership mismatches, holdings gaps, stats errors)
- What was rebuilt and how many rows were affected

### Step 10: Query the data

```bash
# Latest blocks
curl 'http://localhost:3000/blocks/latest?limit=5' | python3 -m json.tool

# A specific block with transactions
curl http://localhost:3000/blocks/22700001 | python3 -m json.tool

# Transaction detail (pick a hash from the block response)
curl http://localhost:3000/transactions/0x<HASH> | python3 -m json.tool

# Address overview
curl http://localhost:3000/addresses/0x<ADDRESS> | python3 -m json.tool

# NFTs owned by an address
curl http://localhost:3000/addresses/0x<ADDRESS>/nfts | python3 -m json.tool

# Search
curl 'http://localhost:3000/search?q=22700001' | python3 -m json.tool
```

### Step 11: Validate against Etherscan

Pick 2-3 transactions and compare against `https://etherscan.io/tx/0x<HASH>`:

| Field | Your API | Etherscan |
|-------|----------|-----------|
| `from` | `.transaction.fromAddress` | From |
| `to` | `.transaction.toAddress` | To |
| `value` | `.transaction.value` (wei) | Value |
| `status` | `.receipt.status` (1 = success) | Status |
| `gasUsed` | `.receipt.gasUsed` | Gas Used |
| log count | `.logs.length` | Logs count |
| token transfers | `.tokenTransfers.length` | Token Transfers tab |

Check:
1. A simple ETH transfer (no logs)
2. An ERC-20 transfer (USDC/USDT — check token address, from, to, amount)
3. A contract interaction with multiple logs

### Step 12: Test live sync (optional)

```bash
# Set START_BLOCK to near chain head in .env
yarn start:dev:worker-ingest   # Terminal 2 — syncs new blocks
yarn start:dev:worker-decode   # Terminal 3 — decodes transfer events
```

The ingest worker enqueues decode jobs via Redis. The decode worker processes them asynchronously. Stop with Ctrl+C — checkpoints save per-block.

---

## Which apps to run

| Scenario | Apps needed |
|----------|------------|
| Controlled backfill test | `api` + `worker-backfill` |
| Live chain sync | `api` + `worker-ingest` + `worker-decode` |
| Full system | `api` + `worker-ingest` + `worker-decode` + `worker-backfill` |

The backfill worker handles decoding inline. The ingest worker delegates decoding to the decode worker via Bull queue.

---

## Post-test workflows

### After backfill

```bash
# Reconcile NFT derived tables
curl -X POST http://localhost:3000/admin/nfts/reconcile | python3 -m json.tool

# Check overall status
curl http://localhost:3000/admin/status | python3 -m json.tool
```

### After reorg

Reorgs are handled automatically by the ingest worker. To verify:

```bash
# Check reorg events
curl 'http://localhost:3000/admin/reorgs?limit=5' | python3 -m json.tool

# Validate NFT state
curl http://localhost:3000/admin/nfts/validate | python3 -m json.tool

# Repair if needed
curl -X POST http://localhost:3000/admin/nfts/reconcile | python3 -m json.tool
```

---

## Troubleshooting

### `CHAIN_RPC_URL environment variable is required`
The `.env` file isn't being loaded. Make sure `.env` exists in the project root with `CHAIN_RPC_URL` set.

### `getaddrinfo ENOTFOUND postgres` or `getaddrinfo ENOTFOUND redis`
You're running apps directly on your machine but `DB_HOST` or `REDIS_HOST` is set to Docker container names. Change them to `localhost` in `.env`.

### `database "blockchain_indexer" does not exist`
```bash
docker compose up postgres -d
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer;"
```

### `relation "blocks" does not exist`
```bash
yarn migration:run
```

### `there is no unique or exclusion constraint matching the ON CONFLICT specification`
This happens if migrations haven't been run after a schema change. Drop and recreate:
```bash
docker compose exec postgres psql -U postgres -c "DROP DATABASE blockchain_indexer;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer;"
yarn migration:run
```

### RPC rate limiting / timeouts
Reduce batch sizes in `.env`:
```env
INGEST_BATCH_SIZE=5
BACKFILL_BATCH_SIZE=5
```

### Backfill seems slow
Each block requires 1 RPC call + 1 call per transaction for receipts. A block with 200 transactions = 201 RPC calls. At free-tier rate limits, expect ~1-3 blocks per second. 100 blocks completes in 1-5 minutes.

---

## Resetting for a fresh test

```bash
# Nuclear: drop and recreate
docker compose exec postgres psql -U postgres -c "DROP DATABASE blockchain_indexer;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer;"
yarn migration:run
```

Or truncate data only:

```bash
docker compose exec postgres psql -U postgres -d blockchain_indexer -c "
  DELETE FROM address_nft_holdings;
  DELETE FROM nft_contract_stats;
  DELETE FROM erc721_ownership;
  DELETE FROM erc1155_balances;
  DELETE FROM nft_token_metadata;
  DELETE FROM nft_transfers;
  DELETE FROM token_transfers;
  DELETE FROM logs;
  DELETE FROM transaction_receipts;
  DELETE FROM transactions;
  DELETE FROM blocks;
  DELETE FROM token_contracts;
  DELETE FROM address_summaries;
  DELETE FROM token_stats;
  DELETE FROM sync_checkpoints;
  DELETE FROM backfill_jobs;
  DELETE FROM reorg_events;
  DELETE FROM contract_standards;
"
```
