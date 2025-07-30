import { PrivyProvider } from '../providers/Walletprovider';
import { WalletButton } from './WalletButton';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <PrivyProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 shadow-sm border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-white">
                  1inch Fusion+ Swap
                </h1>
              </div>
              <nav className="flex items-center space-x-4">
                <WalletButton />
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-gray-800 border-t border-gray-700 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-gray-400">
              © 2025 1inch Fusion+. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </PrivyProvider>
  );
}