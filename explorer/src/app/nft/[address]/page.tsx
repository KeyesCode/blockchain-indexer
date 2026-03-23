import Link from 'next/link';
import { api } from '@/lib/api';
import { truncateHash, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function NftCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { address } = await params;
  const { cursor } = await searchParams;

  let data;
  try {
    data = await api.getNftCollection(address, 25, cursor);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">NFT Collection</h1>
        <p className="text-gray-400 font-mono">{address}</p>
        <p className="text-gray-500 text-sm mt-2">No transfer data found</p>
      </div>
    );
  }

  const transfers = data.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NFT Collection</h1>
        <p className="text-gray-400 font-mono text-sm mt-1 break-all">{address}</p>
      </div>

      {transfers.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800 font-bold">
            Transfers
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Tx Hash</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Token ID</th>
                <th className="px-4 py-2 text-left">From</th>
                <th className="px-4 py-2 text-left">To</th>
                <th className="px-4 py-2 text-right">Block</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transfers.map((t: any, i: number) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-mono">
                    <Link href={`/tx/${t.transactionHash}`} className="text-blue-400 hover:text-blue-300">
                      {truncateHash(t.transactionHash)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${t.tokenType === 'ERC721' ? 'bg-purple-900 text-purple-300' : 'bg-teal-900 text-teal-300'}`}>
                      {t.tokenType}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/nft/${address}/${t.tokenId}`} className="text-blue-400 hover:text-blue-300">
                      #{t.tokenId}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/address/${t.fromAddress}`} className="text-blue-400">
                      {truncateHash(t.fromAddress, 4)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/address/${t.toAddress}`} className="text-blue-400">
                      {truncateHash(t.toAddress, 4)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/block/${t.blockNumber}`} className="text-blue-400 hover:text-blue-300">
                      {formatNumber(t.blockNumber)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.nextCursor && (
            <div className="px-4 py-3 border-t border-gray-800">
              <Link
                href={`/nft/${address}?cursor=${data.nextCursor}`}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
              >
                Next Page
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-400">
          No transfers found for this collection.
        </div>
      )}
    </div>
  );
}
