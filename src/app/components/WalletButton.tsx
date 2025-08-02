'use client';

import { useLogin, useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { fetchBalances, formatBalance, BalanceInfo } from '../utils/balance';

export function WalletButton() {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [balances, setBalances] = useState<{
    arbitrumSepolia: BalanceInfo;
    monadTestnet: BalanceInfo;
  }>({
    arbitrumSepolia: {
      balance: '0',
      formatted: '0.00',
      symbol: 'ETH',
      chain: 'Arbitrum Sepolia',
      isLoading: true,
    },
    monadTestnet: {
      balance: '0',
      formatted: '0.00',
      symbol: 'MON',
      chain: 'Monad Testnet',
      isLoading: true,
    },
  });

  const connectedWallet = wallets.find(wallet => wallet.walletClientType !== 'privy');
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
  const activeWallet = connectedWallet || embeddedWallet;

  // Fetch balances when wallet is connected
  useEffect(() => {
    const fetchBalancesData = async () => {
      if (authenticated && activeWallet?.address) {
        try {
          const fetchedBalances = await fetchBalances(activeWallet.address);
          console.log("Fetched Balances:", fetchedBalances);
          setBalances(fetchedBalances);
        } catch (error) {
          console.error('Error fetching balances in WalletButton:', error);
        }
      }
    };

    fetchBalancesData();
  }, [authenticated, activeWallet?.address]);

  // Disable login when Privy is not ready or the user is already authenticated
  const disableLogin = !ready || (ready && authenticated);

  if (!ready) {
    return (
      <div className="bg-gray-700 animate-pulse h-10 w-32 rounded-lg"></div>
    );
  }

  if (authenticated) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-3 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg border border-gray-600 transition-all duration-200 hover:border-gray-500"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">
              {activeWallet ? `${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)}` : 'Connected'}
            </span>
            <span className="text-xs text-gray-400">
              {connectedWallet ? 'External Wallet' : embeddedWallet ? 'Embedded Wallet' : 'Wallet'}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg border border-gray-700 shadow-lg z-50">
            <div className="p-4">
              {/* User Info */}
              {user?.email?.address && (
                <div className="mb-4 pb-4 border-b border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.email.address.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{user.email.address}</p>
                      <p className="text-gray-400 text-xs">Email Address</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet Info */}
              <div className="mb-4">
                <h3 className="text-white text-sm font-medium mb-2">Connected Wallet</h3>
                <div className="space-y-2">
                  {connectedWallet && (
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">External Wallet</p>
                          <p className="text-gray-400 text-xs font-mono">{connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}</p>
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Balances */}
              <div className="mb-4">
                <h3 className="text-white text-sm font-medium mb-2">Balances</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">W</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Arbitrum Sepolia</p>
                        <p className="text-gray-400 text-xs">
                          {balances.arbitrumSepolia.isLoading 
                            ? 'Loading...' 
                            : `${formatBalance(balances.arbitrumSepolia.formatted)} WETH`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">W</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Monad Testnet</p>
                        <p className="text-gray-400 text-xs">
                          {balances.monadTestnet.isLoading 
                            ? 'Loading...' 
                            : `${formatBalance(balances.monadTestnet.formatted)} WMON`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (activeWallet) {
                      navigator.clipboard.writeText(activeWallet.address);
                    }
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg border border-gray-600 transition-all duration-200 hover:border-gray-500 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Copy Address</span>
                </button>
                
                <button
                  onClick={() => {
                    logout();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm">Disconnect</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backdrop to close dropdown */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <button
      disabled={disableLogin}
      onClick={login}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 border border-blue-500 hover:border-blue-600 disabled:border-gray-600 flex items-center space-x-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>Connect Wallet</span>
    </button>
  );
}

