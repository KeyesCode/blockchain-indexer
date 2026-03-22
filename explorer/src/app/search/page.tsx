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

  try {
    const result = await api.search(q);

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
      default:
        return (
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-6">Search</h1>
            <div className="flex justify-center mb-8">
              <SearchBar />
            </div>
            <p className="text-gray-400">
              No results found for &quot;{q}&quot;
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Try a transaction hash, address, or block number
            </p>
          </div>
        );
    }
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-6">Search</h1>
        <div className="flex justify-center mb-8">
          <SearchBar />
        </div>
        <p className="text-red-400">Search failed. Please try again.</p>
      </div>
    );
  }
}
