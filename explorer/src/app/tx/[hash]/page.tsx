import Link from 'next/link';
import { api } from '@/lib/api';
import { formatNumber, formatWei, truncateHash } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;

  let data;
  try {
    data = await api.getTransaction(hash);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Transaction Not Found</h1>
        <p className="text-gray-400 font-mono break-all">{hash}</p>
      </div>
    );
  }

  const { transaction: tx, receipt, logs, tokenTransfers } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transaction Details</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        {[
          { label: 'Tx Hash', value: tx.hash, mono: true },
          {
            label: 'Status',
            value: receipt ? (receipt.status === 1 ? 'Success' : 'Failed') : 'Pending',
            color: receipt?.status === 1 ? 'text-green-400' : 'text-red-400',
          },
          { label: 'Block', value: formatNumber(tx.blockNumber), link: `/block/${tx.blockNumber}` },
          {
            label: 'From',
            value: tx.fromAddress,
            link: `/address/${tx.fromAddress}`,
            mono: true,
          },
          {
            label: 'To',
            value: tx.toAddress ?? 'Contract Creation',
            link: tx.toAddress ? `/address/${tx.toAddress}` : undefined,
            mono: true,
          },
          { label: 'Value', value: formatWei(tx.value) },
          { label: 'Gas Used', value: receipt ? formatNumber(receipt.gasUsed) : '—' },
          {
            label: 'Gas Price',
            value: receipt?.effectiveGasPrice
              ? `${(Number(receipt.effectiveGasPrice) / 1e9).toFixed(4)} Gwei`
              : tx.gasPrice
                ? `${(Number(tx.gasPrice) / 1e9).toFixed(4)} Gwei`
                : '—',
          },
          { label: 'Tx Type', value: tx.type !== null ? `Type ${tx.type}` : '—' },
        ].map((row) => (
          <div key={row.label} className="flex flex-col sm:flex-row sm:gap-4">
            <div className="text-gray-400 text-sm min-w-[140px]">{row.label}</div>
            <div className={`text-sm break-all ${row.mono ? 'font-mono' : ''} ${row.color ?? ''}`}>
              {row.link ? (
                <Link href={row.link} className="text-blue-400 hover:text-blue-300">{row.value}</Link>
              ) : (
                row.value
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Token Transfers */}
      {tokenTransfers.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800 font-bold">
            ERC-20 Token Transfers ({tokenTransfers.length})
          </div>
          <div className="divide-y divide-gray-800">
            {tokenTransfers.map((t: any, i: number) => (
              <div key={i} className="p-4 flex items-center gap-2 text-sm">
                <span className="text-gray-400">From</span>
                <Link href={`/address/${t.fromAddress}`} className="text-blue-400 font-mono text-xs">
                  {truncateHash(t.fromAddress, 6)}
                </Link>
                <span className="text-gray-400">To</span>
                <Link href={`/address/${t.toAddress}`} className="text-blue-400 font-mono text-xs">
                  {truncateHash(t.toAddress, 6)}
                </Link>
                <span className="text-gray-400 ml-2">Token:</span>
                <Link href={`/token/${t.tokenAddress}`} className="text-blue-400 font-mono text-xs">
                  {truncateHash(t.tokenAddress, 6)}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800 font-bold">
            Event Logs ({logs.length})
          </div>
          <div className="divide-y divide-gray-800">
            {logs.map((log: any, i: number) => (
              <div key={i} className="p-4 space-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="text-gray-400 min-w-[80px]">Log #{log.logIndex}</span>
                  <Link href={`/address/${log.address}`} className="text-blue-400 font-mono">
                    {log.address}
                  </Link>
                </div>
                {log.topic0 && (
                  <div className="font-mono text-gray-500 pl-[88px] break-all">
                    topic0: {log.topic0}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
