import Link from 'next/link';
import { api } from '@/lib/api';
import { formatNumber, timeAgo, truncateHash } from '@/lib/utils';
import Pagination from '@/components/Pagination';

export const dynamic = 'force-dynamic';

export default async function BlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetStr = '0' } = await searchParams;
  const offset = Number(offsetStr);
  const limit = 25;

  let data;
  try {
    data = await api.getLatestBlocks(limit, offset);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Blocks</h1>
        <p className="text-gray-400">Failed to load blocks</p>
      </div>
    );
  }

  const { items: blocks, total } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Blocks</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Block</th>
              <th className="px-4 py-3 text-left">Age</th>
              <th className="px-4 py-3 text-left">Miner</th>
              <th className="px-4 py-3 text-right">Gas Used</th>
              <th className="px-4 py-3 text-right">Base Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {blocks.map((block) => (
              <tr key={block.number} className="hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/block/${block.number}`} className="text-blue-400 hover:text-blue-300 font-mono">
                    {formatNumber(block.number)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-400">{timeAgo(block.timestamp)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {block.miner ? (
                    <Link href={`/address/${block.miner}`} className="text-blue-400 hover:text-blue-300">
                      {truncateHash(block.miner)}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{formatNumber(block.gasUsed)}</td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs">
                  {block.baseFeePerGas ? `${(Number(block.baseFeePerGas) / 1e9).toFixed(2)} Gwei` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > limit && (
          <div className="px-4">
            <Pagination basePath="/blocks" currentOffset={offset} limit={limit} total={total} />
          </div>
        )}
      </div>
    </div>
  );
}
