const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Types
export interface Block {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas: string | null;
  miner: string | null;
  transactions?: Transaction[];
}

export interface Transaction {
  hash: string;
  blockNumber: string;
  transactionIndex: number;
  fromAddress: string;
  toAddress: string | null;
  value: string;
  inputData: string;
  gas: string;
  gasPrice: string | null;
  type: number | null;
}

export interface TransactionDetail {
  transaction: Transaction;
  receipt: {
    transactionHash: string;
    blockNumber: string;
    status: number;
    gasUsed: string;
    effectiveGasPrice: string | null;
  } | null;
  logs: any[];
  tokenTransfers: any[];
}

export interface IndexerStatus {
  indexedHead: string | null;
  earliestBlock: string | null;
  counts: {
    blocks: number;
    transactions: number;
    logs: number;
    tokenTransfers: number;
  };
  checkpoints: Array<{ worker: string; lastBlock: string; updatedAt: string }>;
  backfill: { activeJobs: number };
  reorgCount: number;
}

export interface SearchResult {
  type: 'transaction' | 'block' | 'token' | 'address' | 'none';
  result: any;
}

// API calls
export const api = {
  getStatus: () => fetchApi<IndexerStatus>('/admin/status'),
  getLatestBlocks: (limit = 25, offset = 0) =>
    fetchApi<{ items: Block[]; total: number; limit: number; offset: number }>(`/blocks/latest?limit=${limit}&offset=${offset}`),
  getBlock: (id: string) => fetchApi<Block & { transactions: Transaction[] }>(`/blocks/${id}`),
  getTransaction: (hash: string) => fetchApi<TransactionDetail>(`/transactions/${hash}`),
  getAddress: (address: string) => fetchApi<any>(`/addresses/${address}`),
  getAddressTransactions: (address: string, limit = 25, offset = 0) =>
    fetchApi<any>(`/addresses/${address}/transactions?limit=${limit}&offset=${offset}`),
  getAddressTokenTransfers: (address: string, limit = 25, offset = 0) =>
    fetchApi<any>(`/addresses/${address}/token-transfers?limit=${limit}&offset=${offset}`),
  getAddressNfts: (address: string, limit = 25) =>
    fetchApi<any>(`/addresses/${address}/nfts?limit=${limit}`),
  getAddressDexSwaps: (address: string, limit = 25, cursor?: string) =>
    fetchApi<any>(`/addresses/${address}/dex-swaps?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  getAddressApprovals: (address: string, limit = 25) =>
    fetchApi<any>(`/addresses/${address}/approvals?limit=${limit}`),
  getAddressAllowances: (address: string, limit = 25) =>
    fetchApi<any>(`/addresses/${address}/allowances?limit=${limit}`),
  getAddressNftSales: (address: string, limit = 25, cursor?: string) =>
    fetchApi<any>(`/addresses/${address}/nft-sales?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  getAddressLending: (address: string, limit = 25, cursor?: string) =>
    fetchApi<any>(`/addresses/${address}/lending?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  getTokens: (limit = 25, offset = 0) =>
    fetchApi<{ items: any[]; total: number; limit: number; offset: number }>(`/tokens?limit=${limit}&offset=${offset}`),
  getToken: (address: string, limit = 25, offset = 0) =>
    fetchApi<any>(`/tokens/${address}?limit=${limit}&offset=${offset}`),
  getTokenTransfers: (address: string, limit = 25, offset = 0) =>
    fetchApi<any>(`/tokens/${address}/transfers?limit=${limit}&offset=${offset}`),
  getNftCollection: (address: string, limit = 25, cursor?: string) =>
    fetchApi<any>(`/nfts/collections/${address}/transfers?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  getNftToken: (address: string, tokenId: string) =>
    fetchApi<any>(`/nfts/collections/${address}/tokens/${tokenId}`),
  search: (q: string) => fetchApi<SearchResult>(`/search?q=${encodeURIComponent(q)}`),
};
