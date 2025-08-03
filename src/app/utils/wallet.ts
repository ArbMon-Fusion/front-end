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
        const privySigner = await (embeddedWallet as { getSigner: () => Promise<Signer> }).getSigner();
        setSigner(privySigner);
        setAddress(embeddedWallet.address);
        return;
      }

      // 2. Fallback to Wagmi signer (e.g., MetaMask)
      if (walletClient && wagmiAddress) {
        const { account, transport } = walletClient;

        // ✅ Automatically uses correct network (like 421614 for Arbitrum Sepolia)
        const provider = new BrowserProvider(transport);
        const wagmiSigner = new JsonRpcSigner(provider, account.address);

        const signerAddress = await wagmiSigner.getAddress();
        console.log("Wagmi Signer Address:", signerAddress);

        setSigner(wagmiSigner);
        setAddress(signerAddress);
      }
    };

    fetchSigner();
  }, [wallets, walletClient, wagmiAddress]);

  return { signer, address };
};
