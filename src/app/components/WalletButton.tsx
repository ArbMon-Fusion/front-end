'use client';

import { useLogin, useLogout, usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';

export function WalletButton() {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();

  // Disable login when Privy is not ready or the user is already authenticated
  const disableLogin = !ready || (ready && authenticated);

  if (!ready) {
    return (
      <div className="bg-gray-200 animate-pulse h-10 w-32 rounded-md"></div>
    );
  }

  if (authenticated) {
    const connectedWallet = wallets.find(wallet => wallet.walletClientType !== 'privy');
    const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
    
    return (
      <div className="flex flex-col items-end space-y-2">
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-600">
            {user?.email?.address && (
              <span className="mr-3">{user.email.address}</span>
            )}
            {connectedWallet && (
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
              </span>
            )}
            {!connectedWallet && embeddedWallet && (
              <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">
                {embeddedWallet.address.slice(0, 6)}...{embeddedWallet.address.slice(-4)}
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      disabled={disableLogin}
      onClick={login}
      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
    >
      Connect Wallet
    </button>
  );
}

