import { createPublicClient, http, formatEther } from 'viem';
import { arbitrumSepolia, monadTestnet } from 'viem/chains';
import { erc20Abi } from 'viem';

// Create public clients for each network
const arbitrumSepoliaClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http('https://sepolia-rollup.arbitrum.io/rpc'),
});

const monadTestnetClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz'),
});

// Token contract addresses
const WETH_SEPOLIA_ADDRESS = '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73'; // WETH on Arbitrum Sepolia
const WMON_TESTNET_ADDRESS = '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701'; // TODO: Replace with actual WMON contract address when deployed

export interface BalanceInfo {
  balance: string;
  formatted: string;
  symbol: string;
  chain: string;
  isLoading: boolean;
  error?: string;
}

// Helper function to get ERC-20 token balance
const getTokenBalance = async (
  client: ReturnType<typeof createPublicClient>,
  tokenAddress: string,
  userAddress: string,
  // decimals: number = 18
): Promise<{ balance: bigint; symbol: string }> => {
  try {
    const [balance, symbol] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
    ]);

    return { balance: balance as bigint, symbol: symbol as string };
  } catch (error) {
    console.error(`Error fetching token balance for ${tokenAddress}:`, error);
    throw error;
  }
};

export const fetchBalances = async (address: string): Promise<{
  arbitrumSepolia: BalanceInfo;
  monadTestnet: BalanceInfo;
}> => {
  const defaultBalance: BalanceInfo = {
    balance: '0',
    formatted: '0.00',
    symbol: '',
    chain: '',
    isLoading: false,
  };

  try {
    // Fetch native ETH balance on Arbitrum Sepolia
    // const arbitrumNativeBalance = await arbitrumSepoliaClient.getBalance({
    //   address: address as `0x${string}`,
    // });
    // console.log("Arbitrum native ETH balance:", arbitrumNativeBalance.toString());

    // Fetch WETH balance on Arbitrum Sepolia
    let wethBalance = { balance: BigInt(0), symbol: 'WETH' };
    try {
      wethBalance = await getTokenBalance(
        arbitrumSepoliaClient,
        WETH_SEPOLIA_ADDRESS,
        address
      );
      // console.log("Arbitrum WETH balance:", wethBalance.balance.toString());
    } catch (error) {
      console.warn("Failed to fetch WETH balance, using 0:", error);
    }

    // Fetch native MON balance on Monad testnet
    // const monadNativeBalance = await monadTestnetClient.getBalance({
    //   address: address as `0x${string}`,
    // });
    // console.log("Monad native MON balance:", monadNativeBalance.toString());

    // Fetch WMON balance on Monad testnet (if contract exists)
    let wmonBalance = { balance: BigInt(0), symbol: 'WMON' };
    try {
        wmonBalance = await getTokenBalance(
          monadTestnetClient,
          WMON_TESTNET_ADDRESS,
          address
        );
        // console.log("Monad WMON balance:", wmonBalance.balance.toString());
      } catch (error) {
        console.warn("Failed to fetch WMON balance, using 0:", error);
      }

    return {
      arbitrumSepolia: {
        balance: wethBalance.balance.toString(),
        formatted: formatEther(wethBalance.balance),
        symbol: 'WETH',
        chain: 'Arbitrum Sepolia',
        isLoading: false,
      },
      monadTestnet: {
        balance: wmonBalance.balance.toString(),
        formatted: formatEther(wmonBalance.balance),
        symbol: 'WMON',
        chain: 'Monad Testnet',
        isLoading: false,
      },
    };
  } catch (error) {
    console.error('Error fetching balances:', error);
    return {
      arbitrumSepolia: {
        ...defaultBalance,
        symbol: 'WETH',
        chain: 'Arbitrum Sepolia',
        error: 'Failed to fetch balance',
      },
      monadTestnet: {
        ...defaultBalance,
        symbol: 'WMON',
        chain: 'Monad Testnet',
        error: 'Failed to fetch balance',
      },
    };
  }
};

// Helper function to format balance with proper decimals
export const formatBalance = (balance: string, decimals: number = 4): string => {
  const num = parseFloat(balance);
  if (isNaN(num)) return '0.00';
  
  if (num === 0) return '0.00';
  if (num < 0.0001) return '< 0.0001';
  
  return num.toFixed(decimals);
};

// Helper function to get balance for specific token/chain
export const getBalanceForToken = (
  balances: { arbitrumSepolia: BalanceInfo; monadTestnet: BalanceInfo },
  tokenSymbol: string
): BalanceInfo => {
  if (tokenSymbol === 'WETH' || tokenSymbol === 'ETH') {
    return balances.arbitrumSepolia;
  } else if (tokenSymbol === 'WMON' || tokenSymbol === 'MON') {
    return balances.monadTestnet;
  }
  
  return {
    balance: '0',
    formatted: '0.00',
    symbol: tokenSymbol,
    chain: '',
    isLoading: false,
  };
}; 