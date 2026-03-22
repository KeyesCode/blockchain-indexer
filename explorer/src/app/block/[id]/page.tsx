import Link from 'next/link';
import { api } from '@/lib/api';
import { formatNumber, timeAgo, truncateHash, formatWei } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let block;
  try {
    block = await api.getBlock(id);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Block Not Found</h1>
        <p className="text-gray-400 font-mono">{id}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Block #{formatNumber(block.number)}</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        {[
          { label: 'Block Hash', value: block.hash, mono: true },
          { label: 'Parent Hash', value: block.parentHash, mono: true },
          { label: 'Timestamp', value: `${new Date(block.timestamp).toISOString()} (${timeAgo(block.timestamp)})` },
          { label: 'Transactions', value: `${block.transactions.length} transactions` },
          { label: 'Gas Used', value: `${formatNumber(block.gasUsed)} / ${formatNumber(block.gasLimit)}` },
          { label: 'Base Fee', value: block.baseFeePerGas ? `${(Number(block.baseFeePerGas) / 1e9).toFixed(4)} Gwei` : '—' },
          { label: 'Miner', value: block.miner, link: block.miner ? `/address/${block.miner}` : undefined, mono: true },
        ].map((row) => (
          <div key={row.label} className="flex flex-col sm:flex-row sm:gap-4">
            <div className="text-gray-400 text-sm min-w-[140px]">{row.label}</div>
            <div className={`text-sm break-all ${row.mono ? 'font-mono' : ''}`}>
              {row.link ? (
                <Link href={row.link} className="text-blue-400 hover:text-blue-300">{row.value}</Link>
              ) : (
                row.value
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800 font-bold">
          Transactions ({block.transactions.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">Tx Hash</th>
              <th className="px-4 py-2 text-left">From</th>
              <th className="px-4 py-2 text-left">To</th>
              <th className="px-4 py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {block.transactions.map((tx) => (
              <tr key={tx.hash} className="hover:bg-gray-800/50">
                <td className="px-4 py-2 font-mono">
                  <Link href={`/tx/${tx.hash}`} className="text-blue-400 hover:text-blue-300">
                    {truncateHash(tx.hash)}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/address/${tx.fromAddress}`} className="text-blue-400 hover:text-blue-300">
                    {truncateHash(tx.fromAddress, 6)}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {tx.toAddress ? (
                    <Link href={`/address/${tx.toAddress}`} className="text-blue-400 hover:text-blue-300">
                      {truncateHash(tx.toAddress, 6)}
                    </Link>
                  ) : (
                    <span className="text-yellow-400">Contract Creation</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{formatWei(tx.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
