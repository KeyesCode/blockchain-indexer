Best long-term approach

Make this repo:

a reusable blockchain data platform
with two layers:

1. Core indexer layer

Always present, generic, reusable:

blocks
transactions
receipts
logs
ERC-20 transfers
ERC-721 / ERC-1155 transfers
metadata
read models
reconciliation
API 2. Protocol decoder layer

Optional, pluggable, extensible:

Uniswap V2 swaps
Uniswap V3 swaps
liquidity add/remove
bridge events
staking events
lending protocol events
marketplace fills
custom app-specific contracts

That gives you one repo, one ingestion pipeline, one database strategy, one replay model — but without hard-coding your whole platform around only one use case.

Why this is the right move

If you keep protocol events out completely, every downstream project has to:

re-read raw logs
re-implement protocol decoders
duplicate backfill/reorg logic
duplicate reconciliation logic

That gets messy fast.

If you put protocol decoding directly into the main indexer with no boundaries, the repo becomes:

harder to maintain
less reusable
tightly coupled to whichever protocols you add first

So the sweet spot is:

one repo, modular protocol packages

What I’d recommend structurally
Keep the core canonical

Your source-of-truth remains:

chain data
normalized token/NFT transfers
maybe generic decoded logs later
Add a protocol-events subsystem

Examples:

protocols/uniswap-v2
protocols/uniswap-v3
protocols/aave
protocols/curve
protocols/opensea

Each module can define:

contract identification rules
event signatures
decode logic
persistence tables
rebuild/reconcile rules
API endpoints if needed
Example architecture
apps/
api/
worker-ingest/
worker-decode/
worker-backfill/

libs/
db/
shared/
chain/
nft/
erc20/
protocols/
common/
uniswap-v2/
uniswap-v3/
aave/
What belongs in a protocol module

For Uniswap V2, for example:

Raw inputs already in your core:
transaction
logs
token transfers
contract addresses
Protocol module adds:
pair contract detection
Swap event decoding
token0/token1 lookup
amount0In / amount1In / amount0Out / amount1Out
derived “sold token A, bought token B”
optional router / multi-hop attribution
Output tables:
dex_swaps
maybe liquidity_events
maybe protocol_contracts
Important design rule

Do not treat protocol events as primary truth.

For example:

Primary truth
raw logs
canonical transfers
Derived truth
“Uniswap V2 swap”
“wallet bought ETH with USDC”

That means protocol events should be:

rebuildable from raw indexed data
reorg-safe
decoupled from ingestion truth

Same pattern you already used for NFT read models.

What I would add next if you go this route

Not every protocol at once.

Start by designing a generic protocol decoder framework.

Build:
ProtocolDecoder interface

Something like:

interface ProtocolDecoder {
protocol: string;
canHandle(logsOrTx: unknown): Promise<boolean>;
decodeBlock(blockNumber: number): Promise<void>;
reconcile?(fromBlock?: number, toBlock?: number): Promise<void>;
}

Or better, block/tx scoped methods.

protocol_events registry table

Stores:

protocol name
contract address
contract type
chain id
metadata
protocol-specific tables

Examples:

dex_swaps
liquidity_positions
lending_events
My recommendation for your exact question
Should the blockchain indexer have protocol events?

Yes, if you want this repo to be reusable across multiple projects.

But implement them as:

modular derived decoders
not as part of the minimal core indexing contract

That way this repo becomes:

Core blockchain indexer + optional protocol intelligence primitives

not

Argus inside the indexer

Practical scope boundary
Good to include here
protocol event decoding
protocol-specific normalized tables
protocol contract registries
replay/reorg-safe rebuilds
generic protocol APIs
Better to keep out
alerting
wallet intelligence scoring
“smart money” labels
trading strategy logic
ML classifications
cross-wallet behavior analysis

Those belong in Argus.
