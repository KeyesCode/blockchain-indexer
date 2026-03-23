import Link from 'next/link';
import { api } from '@/lib/api';
import { formatNumber, truncateHash } from '@/lib/utils';
import Pagination from '@/components/Pagination';

export const dynamic = 'force-dynamic';

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { address } = await params;
  const { offset: offsetStr = '0' } = await searchParams;
  const offset = Number(offsetStr);
  const limit = 25;

  let data;
  try {
    data = await api.getToken(address, limit, offset);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Token Not Found</h1>
        <p className="text-gray-400 font-mono">{address}</p>
      </div>
    );
  }

  const { token, recentTransfers, transferTotal } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {token.name ?? 'Unknown Token'} {token.symbol ? `(${token.symbol})` : ''}
        </h1>
        <p className="text-gray-400 font-mono text-sm mt-1 break-all">{token.address}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Symbol', value: token.symbol ?? '—' },
          { label: 'Decimals', value: token.decimals?.toString() ?? '—' },
          { label: 'Standard', value: token.standard ?? 'ERC20' },
          { label: 'Total Transfers', value: transferTotal ? formatNumber(transferTotal) : '—' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">{s.label}</div>
            <div className="text-lg font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800 font-bold">
          Transfers
        </div>
        {recentTransfers?.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">Tx Hash</th>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentTransfers.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-mono">
                      <Link href={`/tx/${t.transactionHash}`} className="text-blue-400 hover:text-blue-300">
                        {truncateHash(t.transactionHash)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/address/${t.fromAddress}`} className="text-blue-400">
                        {truncateHash(t.fromAddress, 6)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/address/${t.toAddress}`} className="text-blue-400">
                        {truncateHash(t.toAddress, 6)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-300 font-mono text-xs">
                      {t.amountRaw}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transferTotal > limit && (
              <div className="px-4">
                <Pagination basePath={`/token/${address}`} currentOffset={offset} limit={limit} total={transferTotal} />
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-gray-400">No transfers found</div>
        )}
      </div>
    </div>
  );
}
