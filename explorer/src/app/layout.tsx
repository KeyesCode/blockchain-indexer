import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Argus Explorer',
  description: 'Blockchain explorer powered by Argus-Core',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-blue-400 hover:text-blue-300">
              Argus Explorer
            </Link>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/blocks" className="hover:text-white">Blocks</Link>
              <Link href="/tokens" className="hover:text-white">Tokens</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
