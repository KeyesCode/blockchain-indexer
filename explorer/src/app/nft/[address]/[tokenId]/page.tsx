import Link from 'next/link';
import { api } from '@/lib/api';
import { truncateHash, formatNumber } from '@/lib/utils';
import NftImage from '@/components/NftImage';

export const dynamic = 'force-dynamic';

export default async function NftTokenPage({
  params,
}: {
  params: Promise<{ address: string; tokenId: string }>;
}) {
  const { address, tokenId } = await params;

  let data;
  try {
    data = await api.getNftToken(address, tokenId);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">NFT Not Found</h1>
        <p className="text-gray-400 font-mono">{address} #{tokenId}</p>
      </div>
    );
  }

  const { metadata, owners, recentTransfers } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {metadata?.name ?? `Token #${tokenId}`}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          <Link href={`/nft/${address}`} className="text-blue-400 hover:text-blue-300 font-mono">
            {address}
          </Link>
          {' '} — Token #{tokenId}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          {metadata?.imageUrl && (
            <div className="p-4 flex justify-center bg-gray-800">
              <NftImage src={metadata.imageUrl} alt={metadata.name ?? `Token #${tokenId}`} />
            </div>
          )}
          <div className="p-4 space-y-3">
            {metadata?.description && (
              <div>
                <div className="text-gray-400 text-sm">Description</div>
                <div className="text-sm mt-1">{metadata.description}</div>
              </div>
            )}
            {metadata?.tokenUri && (
              <div>
                <div className="text-gray-400 text-sm">Token URI</div>
                <div className="text-xs font-mono mt-1 break-all text-gray-300">{metadata.tokenUri}</div>
              </div>
            )}
            <div>
              <div className="text-gray-400 text-sm">Metadata Status</div>
              <div className="text-sm mt-1">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  metadata?.fetchStatus === 'success' ? 'bg-green-900 text-green-300' :
                  metadata?.fetchStatus === 'failed' ? 'bg-red-900 text-red-300' :
                  'bg-yellow-900 text-yellow-300'
                }`}>
                  {metadata?.fetchStatus ?? 'unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Owners */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg">
          <div className="p-4 border-b border-gray-800 font-bold">
            Owner{owners.length !== 1 ? 's' : ''} ({owners.length})
          </div>
          <div className="divide-y divide-gray-800">
            {owners.length > 0 ? (
              owners.map((owner: any, i: number) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <Link href={`/address/${owner.ownerAddress}`} className="text-blue-400 font-mono text-sm hover:text-blue-300">
                    {truncateHash(owner.ownerAddress)}
                  </Link>
                  {owner.balance && BigInt(owner.balance) > 1n && (
                    <span className="text-gray-400 text-sm">qty: {owner.balance}</span>
                  )}
                  {owner.quantity && BigInt(owner.quantity) > 1n && (
                    <span className="text-gray-400 text-sm">qty: {owner.quantity}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-gray-400 text-sm">No current owner (burned)</div>
            )}
          </div>
        </div>
      </div>

      {/* Transfer History */}
      {recentTransfers?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800 font-bold">
            Transfer History ({recentTransfers.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Tx Hash</th>
                <th className="px-4 py-2 text-left">From</th>
                <th className="px-4 py-2 text-left">To</th>
                <th className="px-4 py-2 text-right">Block</th>
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
                  <td className="px-4 py-2 text-right">
                    <Link href={`/block/${t.blockNumber}`} className="text-blue-400">
                      {formatNumber(t.blockNumber)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
