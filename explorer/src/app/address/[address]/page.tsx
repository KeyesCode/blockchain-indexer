import Link from 'next/link';
import { api } from '@/lib/api';
import { formatNumber, formatWei, truncateHash } from '@/lib/utils';
import Pagination from '@/components/Pagination';

export const dynamic = 'force-dynamic';

type Tab = 'txs' | 'tokens' | 'nfts' | 'swaps' | 'approvals' | 'nft-sales' | 'lending';

export default async function AddressPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ tab?: string; offset?: string; cursor?: string }>;
}) {
  const { address } = await params;
  const { tab = 'txs', offset: offsetStr = '0', cursor } = await searchParams;
  const offset = Number(offsetStr);
  const limit = 25;
  const activeTab = tab as Tab;

  let overview: any;
  try {
    overview = await api.getAddress(address);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Address Not Found</h1>
        <p className="text-gray-400 font-mono break-all">{address}</p>
      </div>
    );
  }

  let tabData: any = null;
  try {
    switch (activeTab) {
      case 'txs':
        tabData = await api.getAddressTransactions(address, limit, offset);
        break;
      case 'tokens':
        tabData = await api.getAddressTokenTransfers(address, limit, offset);
        break;
      case 'nfts':
        tabData = await api.getAddressNfts(address, limit);
        break;
      case 'swaps':
        tabData = await api.getAddressDexSwaps(address, limit, cursor);
        break;
      case 'approvals':
        tabData = await api.getAddressAllowances(address, limit);
        break;
      case 'nft-sales':
        tabData = await api.getAddressNftSales(address, limit, cursor);
        break;
      case 'lending':
        tabData = await api.getAddressLending(address, limit, cursor);
        break;
    }
  } catch {}

  const tabs: { key: Tab; label: string }[] = [
    { key: 'txs', label: 'Transactions' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'nfts', label: 'NFTs' },
    { key: 'swaps', label: 'DEX Swaps' },
    { key: 'approvals', label: 'Allowances' },
    { key: 'nft-sales', label: 'NFT Sales' },
    { key: 'lending', label: 'Lending' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Address</h1>
        <p className="text-gray-400 font-mono text-sm mt-1 break-all">{overview.address}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Transactions</div>
          <div className="text-xl font-bold mt-1">{formatNumber(overview.transactionCount)}</div>
        </div>
        {overview.transferCount > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Token Transfers</div>
            <div className="text-xl font-bold mt-1">{formatNumber(overview.transferCount)}</div>
          </div>
        )}
        {overview.firstSeenBlock && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">First Seen</div>
            <div className="text-lg font-bold mt-1">
              <Link href={`/block/${overview.firstSeenBlock}`} className="text-blue-400">#{formatNumber(overview.firstSeenBlock)}</Link>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/address/${address}?tab=${t.key}`}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition ${
              activeTab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {activeTab === 'txs' && tabData && (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">Tx Hash</th>
                  <th className="px-4 py-2 text-left">Block</th>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {(tabData.items ?? []).map((tx: any) => (
                  <tr key={tx.hash} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-mono"><Link href={`/tx/${tx.hash}`} className="text-blue-400">{truncateHash(tx.hash)}</Link></td>
                    <td className="px-4 py-2"><Link href={`/block/${tx.blockNumber}`} className="text-blue-400">{formatNumber(tx.blockNumber)}</Link></td>
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/address/${tx.fromAddress}`} className="text-blue-400">{truncateHash(tx.fromAddress, 4)}</Link></td>
                    <td className="px-4 py-2 font-mono text-xs">{tx.toAddress ? <Link href={`/address/${tx.toAddress}`} className="text-blue-400">{truncateHash(tx.toAddress, 4)}</Link> : <span className="text-yellow-400">Contract</span>}</td>
                    <td className="px-4 py-2 text-right">{formatWei(tx.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tabData.total > limit && <div className="px-4"><Pagination basePath={`/address/${address}?tab=txs`} currentOffset={offset} limit={limit} total={tabData.total} /></div>}
          </>
        )}

        {activeTab === 'tokens' && tabData && (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr><th className="px-4 py-2 text-left">Tx Hash</th><th className="px-4 py-2 text-left">Token</th><th className="px-4 py-2 text-left">From</th><th className="px-4 py-2 text-left">To</th><th className="px-4 py-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {(tabData.items ?? []).map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-mono"><Link href={`/tx/${t.transactionHash}`} className="text-blue-400">{truncateHash(t.transactionHash)}</Link></td>
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/token/${t.tokenAddress}`} className="text-blue-400">{truncateHash(t.tokenAddress, 4)}</Link></td>
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/address/${t.fromAddress}`} className="text-blue-400">{truncateHash(t.fromAddress, 4)}</Link></td>
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/address/${t.toAddress}`} className="text-blue-400">{truncateHash(t.toAddress, 4)}</Link></td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{t.amountRaw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tabData.total > limit && <div className="px-4"><Pagination basePath={`/address/${address}?tab=tokens`} currentOffset={offset} limit={limit} total={tabData.total} /></div>}
          </>
        )}

        {activeTab === 'nfts' && tabData && (
          <div className="divide-y divide-gray-800">
            {(tabData.items ?? []).length > 0 ? (tabData.items ?? []).map((nft: any, i: number) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div>
                  <Link href={`/nft/${nft.tokenAddress}/${nft.tokenId}`} className="text-blue-400 font-mono text-sm">{truncateHash(nft.tokenAddress, 6)} #{nft.tokenId}</Link>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${nft.tokenType === 'ERC721' ? 'bg-purple-900 text-purple-300' : 'bg-teal-900 text-teal-300'}`}>{nft.tokenType}</span>
                </div>
                <span className="text-gray-400 text-sm">qty: {nft.quantity}</span>
              </div>
            )) : <div className="p-8 text-center text-gray-400">No NFTs held</div>}
          </div>
        )}

        {activeTab === 'swaps' && tabData && (
          <>
            <div className="divide-y divide-gray-800">
              {(tabData.items ?? []).length > 0 ? (tabData.items ?? []).map((s: any, i: number) => (
                <div key={i} className="p-4 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">{s.protocolName}</span>
                    <Link href={`/tx/${s.transactionHash}`} className="text-blue-400 font-mono text-xs">{truncateHash(s.transactionHash)}</Link>
                    <span className="text-gray-500 text-xs">Block {formatNumber(s.blockNumber)}</span>
                  </div>
                  <div className="text-xs text-gray-400">Pair: <span className="font-mono">{truncateHash(s.pairAddress, 6)}</span></div>
                </div>
              )) : <div className="p-8 text-center text-gray-400">No DEX swaps</div>}
            </div>
            {tabData.nextCursor && (
              <div className="px-4 py-3 border-t border-gray-800">
                <Link href={`/address/${address}?tab=swaps&cursor=${tabData.nextCursor}`} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700">
                  Next Page
                </Link>
              </div>
            )}
          </>
        )}

        {activeTab === 'approvals' && tabData && (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr><th className="px-4 py-2 text-left">Token</th><th className="px-4 py-2 text-left">Spender</th><th className="px-4 py-2 text-right">Allowance</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(tabData.items ?? []).length > 0 ? (tabData.items ?? []).map((a: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-mono text-xs"><Link href={`/token/${a.tokenAddress}`} className="text-blue-400">{truncateHash(a.tokenAddress, 6)}</Link></td>
                  <td className="px-4 py-2 font-mono text-xs"><Link href={`/address/${a.spenderAddress}`} className="text-blue-400">{truncateHash(a.spenderAddress, 6)}</Link></td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{BigInt(a.valueRaw) > BigInt('1000000000000000000000000000000') ? 'Unlimited' : a.valueRaw}</td>
                </tr>
              )) : <tr><td colSpan={3} className="p-8 text-center text-gray-400">No active allowances</td></tr>}
            </tbody>
          </table>
        )}

        {activeTab === 'nft-sales' && tabData && (
          <>
            <div className="divide-y divide-gray-800">
              {(tabData.items ?? []).length > 0 ? (tabData.items ?? []).map((s: any, i: number) => (
                <div key={i} className="p-4 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-900 text-purple-300">{s.protocolName}</span>
                    <Link href={`/tx/${s.transactionHash}`} className="text-blue-400 font-mono text-xs">{truncateHash(s.transactionHash)}</Link>
                    <span className="text-gray-500 text-xs">Block {formatNumber(s.blockNumber)}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-x-3">
                    <span>Collection: <Link href={`/nft/${s.collectionAddress}`} className="text-blue-400 font-mono">{truncateHash(s.collectionAddress, 6)}</Link></span>
                    <span>Token: <Link href={`/nft/${s.collectionAddress}/${s.tokenId}`} className="text-blue-400 font-mono">#{s.tokenId}</Link></span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 space-x-3">
                    <span>Seller: <Link href={`/address/${s.seller}`} className="text-blue-400 font-mono">{truncateHash(s.seller, 4)}</Link></span>
                    <span>Buyer: <Link href={`/address/${s.buyer}`} className="text-blue-400 font-mono">{truncateHash(s.buyer, 4)}</Link></span>
                    {s.totalPrice && <span>Price: <span className="text-white font-mono">{formatWei(s.totalPrice)}</span></span>}
                  </div>
                </div>
              )) : <div className="p-8 text-center text-gray-400">No NFT sales</div>}
            </div>
            {tabData.nextCursor && (
              <div className="px-4 py-3 border-t border-gray-800">
                <Link href={`/address/${address}?tab=nft-sales&cursor=${tabData.nextCursor}`} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700">
                  Next Page
                </Link>
              </div>
            )}
          </>
        )}

        {activeTab === 'lending' && tabData && (
          <>
            <div className="divide-y divide-gray-800">
              {(tabData.items ?? []).length > 0 ? (tabData.items ?? []).map((e: any, i: number) => (
                <div key={i} className="p-4 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">{e.protocolName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      e.eventType === 'DEPOSIT' ? 'bg-blue-900 text-blue-300' : e.eventType === 'BORROW' ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'
                    }`}>{e.eventType}</span>
                    <Link href={`/tx/${e.transactionHash}`} className="text-blue-400 font-mono text-xs">{truncateHash(e.transactionHash)}</Link>
                  </div>
                  <div className="text-xs text-gray-400">Asset: <span className="font-mono">{truncateHash(e.assetAddress, 6)}</span> | Amount: {e.amount}</div>
                </div>
              )) : <div className="p-8 text-center text-gray-400">No lending activity</div>}
            </div>
            {tabData.nextCursor && (
              <div className="px-4 py-3 border-t border-gray-800">
                <Link href={`/address/${address}?tab=lending&cursor=${tabData.nextCursor}`} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700">
                  Next Page
                </Link>
              </div>
            )}
          </>
        )}

        {!tabData && <div className="p-8 text-center text-gray-400">Failed to load data</div>}
      </div>
    </div>
  );
}
