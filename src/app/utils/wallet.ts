import { useEffect, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount, useWalletClient } from "wagmi";
import { Signer, JsonRpcSigner, BrowserProvider } from "ethers";

export const useUnifiedSigner = () => {
  const [signer, setSigner] = useState<Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const { wallets } = useWallets();
  const { data: walletClient } = useWalletClient();
  const { address: wagmiAddress } = useAccount();

  useEffect(() => {
    const fetchSigner = async () => {
      // 1. Check for Privy Embedded Wallet
      const embeddedWallet = wallets.find(
        (w) => w.walletClientType === "privy"
      );

      if (
        embeddedWallet &&
        "getSigner" in embeddedWallet &&
        typeof embeddedWallet.getSigner === "function"
      ) {
        const privySigner = await (embeddedWallet as any).getSigner();
        setSigner(privySigner);
        setAddress(embeddedWallet.address);
        return;
      }

      // 2. Fallback to Wagmi signer (e.g., MetaMask)
      if (walletClient && wagmiAddress) {
        // Convert Wagmi wallet client to ethers signer
        const { account, chain, transport } = walletClient;
        const network = {
          chainId: chain.id,
          name: chain.name,
          ensAddress: chain.contracts?.ensRegistry?.address,
        };

        const provider = new BrowserProvider(transport, network);
        console.log("Using Wagmi Signer:", provider);
        const wagmiSigner = new JsonRpcSigner(provider, account.address);
        console.log("Wagmi Signer Address:", wagmiAddress);
        setSigner(wagmiSigner);
        setAddress(wagmiAddress);
      }
    };

    fetchSigner();
  }, [wallets, walletClient, wagmiAddress]);

  return { signer, address };
};
