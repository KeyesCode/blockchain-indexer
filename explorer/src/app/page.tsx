import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import { api } from '@/lib/api';
import { formatNumber, timeAgo, truncateHash } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let status;
  let blocks;

  try {
    const [statusResult, blocksResult] = await Promise.all([
      api.getStatus(),
      api.getLatestBlocks(10),
    ]);
    status = statusResult;
    blocks = blocksResult.items;
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Argus Explorer</h1>
        <p className="text-gray-400">Cannot connect to API at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}</p>
        <p className="text-gray-500 text-sm mt-2">Make sure the API is running</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold mb-6">Argus Explorer</h1>
        <div className="flex justify-center">
          <SearchBar />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Latest Block', value: status.indexedHead ? formatNumber(status.indexedHead) : '—' },
          { label: 'Transactions', value: formatNumber(status.counts.transactions) },
          { label: 'Logs', value: formatNumber(status.counts.logs) },
          { label: 'Token Transfers', value: formatNumber(status.counts.tokenTransfers) },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">{stat.label}</div>
            <div className="text-xl font-bold mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Latest Blocks */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="font-bold">Latest Blocks</h2>
          <Link href="/blocks" className="text-blue-400 text-sm hover:text-blue-300">View all</Link>
        </div>
        <div className="divide-y divide-gray-800">
          {blocks.map((block) => (
            <div key={block.number} className="p-4 flex items-center justify-between hover:bg-gray-800/50">
              <div className="flex items-center gap-4">
                <div className="bg-gray-800 rounded-lg p-2 text-sm font-mono text-blue-400 min-w-[4rem] text-center">
                  {formatNumber(block.number)}
                </div>
                <div>
                  <div className="text-sm text-gray-400">{timeAgo(block.timestamp)}</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {block.miner ? truncateHash(block.miner) : '—'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Link href={`/block/${block.number}`} className="text-blue-400 text-sm hover:text-blue-300">
                  {block.transactions?.length ?? '—'} txns
                </Link>
                <div className="text-xs text-gray-500">{formatNumber(block.gasUsed)} gas</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
