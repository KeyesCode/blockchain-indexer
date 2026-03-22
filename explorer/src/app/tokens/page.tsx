import Link from 'next/link';
import { api } from '@/lib/api';
import { truncateHash } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  let tokens: any[] = [];
  try {
    tokens = await api.getTokens();
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Tokens</h1>
        <p className="text-gray-400">Failed to load tokens</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Indexed Tokens</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Token</th>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-right">Decimals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {tokens.length > 0 ? tokens.map((t: any) => (
              <tr key={t.address} className="hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/token/${t.address}`} className="text-blue-400 hover:text-blue-300">
                    {t.name ?? 'Unknown'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-300">{t.symbol ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/token/${t.address}`} className="text-blue-400 hover:text-blue-300">
                    {truncateHash(t.address)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{t.decimals ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">No tokens indexed yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
