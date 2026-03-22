import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import SearchBar from '@/components/SearchBar';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  if (!q) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-6">Search</h1>
        <div className="flex justify-center">
          <SearchBar />
        </div>
      </div>
    );
  }

  const trimmed = q.trim();

  let result;
  try {
    result = await api.search(trimmed);
  } catch {
    // API unreachable — show error with the search bar so they can retry
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-6">Search</h1>
        <div className="flex justify-center mb-8">
          <SearchBar />
        </div>
        <p className="text-red-400">
          Could not connect to the indexer API. Make sure the backend is running.
        </p>
      </div>
    );
  }

  switch (result.type) {
    case 'block':
      redirect(`/block/${result.result.number}`);
    case 'transaction':
      redirect(`/tx/${result.result.hash}`);
    case 'address':
      redirect(`/address/${result.result.address}`);
    case 'token':
      redirect(`/token/${result.result.address}`);
    case 'none':
    default: {
      // Determine what the user was likely looking for
      const isAddress = trimmed.startsWith('0x') && trimmed.length === 42;
      const isTxHash = trimmed.startsWith('0x') && trimmed.length === 66;
      const isBlockNum = /^\d+$/.test(trimmed);

      return (
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-6">Search</h1>
          <div className="flex justify-center mb-8">
            <SearchBar />
          </div>

          <div className="max-w-lg mx-auto bg-gray-900 border border-gray-800 rounded-lg p-6">
            {isAddress && (
              <>
                <p className="text-gray-300 mb-2">
                  Address not found in indexed data
                </p>
                <p className="text-gray-500 text-sm mb-4 font-mono break-all">
                  {trimmed}
                </p>
                <p className="text-gray-500 text-sm">
                  This address may not have any activity in the block range currently indexed.
                  The indexer only covers the blocks that have been synced so far.
                </p>
              </>
            )}

            {isTxHash && (
              <>
                <p className="text-gray-300 mb-2">
                  Transaction not found
                </p>
                <p className="text-gray-500 text-sm mb-4 font-mono break-all">
                  {trimmed}
                </p>
                <p className="text-gray-500 text-sm">
                  This transaction may be outside the currently indexed block range,
                  or the hash may be incorrect.
                </p>
              </>
            )}

            {isBlockNum && (
              <>
                <p className="text-gray-300 mb-2">
                  Block #{Number(trimmed).toLocaleString()} not found
                </p>
                <p className="text-gray-500 text-sm">
                  This block has not been indexed yet. Check the home page
                  to see the current indexed range.
                </p>
              </>
            )}

            {!isAddress && !isTxHash && !isBlockNum && (
              <>
                <p className="text-gray-300 mb-2">
                  No results found for &quot;{trimmed}&quot;
                </p>
                <p className="text-gray-500 text-sm">
                  Try a transaction hash (0x..., 66 chars), wallet address (0x..., 42 chars),
                  or block number.
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
  }
}
