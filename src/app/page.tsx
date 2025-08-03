"use client";

import React, { useState, useEffect } from "react";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import { useUnifiedSigner } from "./utils/wallet";
import { createCrossChainOrder, signCrossChainOrder } from "./utils/createCrossChainOrder";
import { executePhase2, executePhase3, executePhase4 } from "./utils/resolverOperations";
import { fetchBalances, formatBalance, getBalanceForToken, BalanceInfo } from "./utils/balance";
import { checkAndRequestApproval, getLOPContract, getTokenAddress } from "./utils/tokenApproval";
import { parseUnits } from "ethers";

// Declare window.ethereum interface for TypeScript
declare global {
  interface Window {
    ethereum?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

export default function Home(): React.ReactElement {
  const { wallets } = useWallets();
  const { authenticated } = usePrivy();
  const { signer, address } = useUnifiedSigner();
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [currentRate, setCurrentRate] = useState<number>(0.9); // 1 WETH = 0.9 WMON (fixed rate)
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
  const [fromToken, setFromToken] = useState<{ symbol: string; chain: string }>(
    { symbol: "WETH", chain: "Arbitrum Sepolia" }
  );
  const [toToken, setToToken] = useState<{ symbol: string; chain: string }>({
    symbol: "WMON",
    chain: "Monad Testnet",
  });
  const [showStatusPanel, setShowStatusPanel] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [encouragementMessage, setEncouragementMessage] = useState<string>("");
  const [currentChain, setCurrentChain] = useState<string>("");
  const [targetChain, setTargetChain] = useState<string>("");
  const [swapPaused, setSwapPaused] = useState<boolean>(false);
  const [isSwapButtonHovered, setIsSwapButtonHovered] = useState<boolean>(false);
  const [swapSuccess, setSwapSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string>("");
  const [showExecutionModal, setShowExecutionModal] = useState<boolean>(false);
  const [swapInProgress, setSwapInProgress] = useState<boolean>(false);
 
  const [steps, setSteps] = useState<
    Array<{
      id: string;
      text: string;
      status: "completed" | "pending" | "waiting";
      txLink?: string;
    }>
  >([
    {
      id: "step1",
      text: "Creating and signing cross-chain order",
      status: "waiting",
      txLink: "",
    },
    {
      id: "step2",
      text: "Deploying source escrow",
      status: "waiting",
      txLink: "",
    },
    {
      id: "step3",
      text: "Deploying destination escrow",
      status: "waiting",
      txLink: "",
    },
    {
      id: "step4",
      text: "Completing withdrawals and finalizing swap",
      status: "waiting",
      txLink: "",
    },
  ]);

  // Get connected wallet details
  const connectedWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = connectedWallet?.address || embeddedWallet?.address;
  const chainId = connectedWallet?.chainId;
  console.log("Connected wallet:", connectedWallet);
  console.log("Line number 113:",chainId);

  // Define accepted chain IDs
  console.log("Current chainId type:", typeof chainId, "value:", chainId);
  // console.log("Is valid chain:", isValidChain);

  // Function to switch chain automatically
  const switchChainAutomatically = async (targetChainId: number) => {
    if (!connectedWallet || !window.ethereum) return false;
    
    try {
      console.log("Attempting to switch to chain:", targetChainId);
      const chainIdHex = `0x${targetChainId.toString(16)}`;
      console.log("Line number 472:", chainIdHex);
      // First try to switch to the chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      
      console.log(`✅ Successfully switched to chain ${targetChainId}`);
      return true;
    } catch (switchError) {
      // If the chain hasn't been added to the wallet, add it
      if ((switchError as { code?: number }).code === 4902) {
        try {
          const chainData = getChainData(targetChainId);
          if (chainData) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [chainData],
            });
            console.log(`✅ Successfully added and switched to chain ${targetChainId}`);
            return true;
          }
        } catch (addError) {
          console.error("Failed to add chain:", addError);
          return false;
        }
      } else {
        console.error("Failed to switch chain:", switchError);
        return false;
      }
    }
    return false;
  };

  // Get chain configuration data
  const getChainData = (chainId: number) => {
    const chainIdHex = `0x${chainId.toString(16)}`;
    
    if (chainId === 421614) {
      return {
        chainId: chainIdHex,
        chainName: 'Arbitrum Sepolia',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://sepolia.arbiscan.io/'],
      };
    } else if (chainId === 10143) {
      return {
        chainId: chainIdHex,
        chainName: 'Monad Testnet',
        nativeCurrency: {
          name: 'Monad',
          symbol: 'MON',
          decimals: 18,
        },
        rpcUrls: ['https://testnet-rpc.monad.xyz'],
        blockExplorerUrls: ['https://monad-testnet.socialscan.io/'],
      };
    }
    return null;
  };

  // Simple network switching: WETH = Arbitrum Sepolia, WMON = Monad
  useEffect(() => {
    if (!authenticated || !connectedWallet || !chainId) return;
    
    // Parse chainId
    let numericChainId: number;
    // if (typeof chainId === 'string' && chainId.includes(':')) {
    //   numericChainId = parseInt(chainId.split(':')[1]);
    // } else {
    //   numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    // }
    numericChainId = Number(chainId?.toString().split(':').pop());
    console.log("Line number 472:", numericChainId);

    // WETH = Arbitrum Sepolia (421614), WMON = Monad (10143)
    const requiredChainId = fromToken.symbol === "WETH" ? 421614 : 10143;
    console.log("Line number 472:", numericChainId, requiredChainId);
    
    console.log(`Token: ${fromToken.symbol}, Current chain: ${numericChainId}, Required: ${requiredChainId}`);
    
    // Switch only if on wrong chain
    if (numericChainId !== requiredChainId) {
      console.log(`Switching to ${requiredChainId === 421614 ? 'Arbitrum Sepolia' : 'Monad'}`);
      switchChainAutomatically(requiredChainId);
    } else {
      setNetworkError("");
    }
  }, [fromToken.symbol]);

  // Fetch balances from both networks
  const fetchAndUpdateBalances = async () => {
    if (!authenticated || !walletAddress) {
      setBalances({
        arbitrumSepolia: {
          balance: '0',
          formatted: '0.00',
          symbol: 'WETH',
          chain: 'Arbitrum Sepolia',
          isLoading: false,
        },
        monadTestnet: {
          balance: '0',
          formatted: '0.00',
          symbol: 'WMON',
          chain: 'Monad Testnet',
          isLoading: false,
        },
      });
      return;
    }

    try {
      const fetchedBalances = await fetchBalances(walletAddress);
      setBalances(fetchedBalances);
    } catch (error) {
      console.error('Error fetching balances:', error);
      setBalances(prev => ({
        arbitrumSepolia: {
          ...prev.arbitrumSepolia,
          isLoading: false,
          error: 'Failed to fetch balance',
        },
        monadTestnet: {
          ...prev.monadTestnet,
          isLoading: false,
          error: 'Failed to fetch balance',
        },
      }));
    }
  };

  // Update balances based on wallet connection
  useEffect(() => {
    fetchAndUpdateBalances();
  }, [authenticated, walletAddress]);

  // Refresh balances every 30 seconds
  useEffect(() => {
    if (!authenticated || !walletAddress) return;

    const interval = setInterval(() => {
      fetchAndUpdateBalances();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [authenticated, walletAddress]);

  const getFromBalance = () => {
    const balanceInfo = getBalanceForToken(balances, fromToken.symbol);
    return balanceInfo.isLoading ? 'Loading...' : formatBalance(balanceInfo.formatted);
  };

  const getToBalance = () => {
    const balanceInfo = getBalanceForToken(balances, toToken.symbol);
    return balanceInfo.isLoading ? 'Loading...' : formatBalance(balanceInfo.formatted);
  };

  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!authenticated) return;
    const amount = parseFloat(e.target.value) || 0;
    setFromAmount(e.target.value);
    // Use more precise calculation with proper rounding
    const calculatedAmount = amount * currentRate;
    setToAmount(calculatedAmount > 0 ? calculatedAmount.toFixed(6) : "0");
  };

  const swapTokens = () => {
    if (!authenticated) return;
    
    console.log("🔄 Swapping tokens:", fromToken.symbol, "↔", toToken.symbol);
    
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    
    // Fixed rate calculation - maintain consistent rate
    // When swapping from WETH to WMON: rate = 0.9 (1 WETH = 0.9 WMON)
    // When swapping from WMON to WETH: rate = 1/0.9 ≈ 1.1111 (1 WMON = 1.1111 WETH)
    const newRate = toToken.symbol === "WETH" ? (1 / 0.9) : 0.9;
    setCurrentRate(newRate);
    
    if (fromAmount) {
      const amount = parseFloat(fromAmount);
      const calculatedAmount = amount * newRate;
      setToAmount(calculatedAmount > 0 ? calculatedAmount.toFixed(6) : "0");
    }
    
    console.log("✅ After swap - From:", toToken.symbol, "To:", tempToken.symbol);
  };

  // Helper function to get explorer URL
  const getExplorerUrl = (txHash: string, chainId: number): string => {
    if (chainId === 421614) {
      return `https://sepolia.arbiscan.io/tx/${txHash}`;
    } else if (chainId === 10143) {
      return `https://monad-testnet.socialscan.io/tx/${txHash}`;
    }
    return `https://etherscan.io/tx/${txHash}`;
  };

  const executeSwap = async () => {
    if (!authenticated || isSwapping || !fromAmount || !signer) {
      setErrorMessage("Please connect your wallet and enter an amount to continue");
      return;
    }
    
    setErrorMessage("");
    setNetworkError("");
    setSwapSuccess(false);

    // Directly execute the swap - approval is handled in SignOrder component
    executeRealSwap();
  };


  // Real cross-chain swap execution
  const executeRealSwap = async () => {
    if (!authenticated || !signer || !address || !fromAmount) {
      setErrorMessage("Please connect your wallet and enter an amount to continue");
      return;
    }

    setIsSwapping(true);
    setShowExecutionModal(true);
    setSwapInProgress(true);
    setSwapPaused(false);
    setErrorMessage("");
    setNetworkError("");
    setSwapSuccess(false);
    setIsLoading(true);

    try {
      // Determine swap direction
      const swapDirection = fromToken.symbol === "WETH" ? "WETH_TO_WMON" : "WMON_TO_WETH";
      
      // Update step 1 for approval
      setSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: "pending", text: "Checking token approval..." } : step
      ));
      setProgress(15);

      // Token approval step before order creation
      console.log("🔐 Checking token approval before order creation...");
      const tokenAddress = getTokenAddress(swapDirection);
      const lopContract = getLOPContract(swapDirection);
      const makingAmount = parseUnits(fromAmount, 18);
      
      await checkAndRequestApproval(
        signer,
        address,
        tokenAddress,
        lopContract,
        makingAmount,
        swapDirection
      );

      // Update step 1 for order creation
      setSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: "pending", text: "Creating and signing cross-chain order..." } : step
      ));
      setProgress(25);

      // Phase 1: Create and sign order
      console.log("🚀 Starting Phase 1: Cross-chain order creation...");
      const orderData = await createCrossChainOrder(address, fromAmount, swapDirection);
      const orderChainId = swapDirection === "WETH_TO_WMON" ? 421614 : 10143;
      console.log("Line number 503:", orderChainId);
      const signatureData = await signCrossChainOrder(signer, orderData.order, orderChainId);
      console.log("✍️ Order signed successfully! line number 505", signatureData);

      // Store for next phases
      (window as any).orderData = { // eslint-disable-line @typescript-eslint/no-explicit-any
        order: orderData.order,
        signature: signatureData.signature,
        secret: orderData.secret,
        orderHash: signatureData.orderHash,
        swapDirection: orderData.swapDirection,
        chainId: orderChainId
      };

      // Update step 1 as completed
      setSteps(prev => prev.map((step, index) => 
        index === 0 ? { 
          ...step, 
          status: "completed", 
          text: "Order created and signed", 
          txLink: signatureData.orderHash ? getExplorerUrl(signatureData.orderHash, orderChainId) : ""
        } : step
      ));
      setProgress(50);

      // Phase 2: Deploy source escrow
      setSteps(prev => prev.map((step, index) => 
        index === 1 ? { 
          ...step, 
          status: "pending", 
          text: `Deploying source escrow on ${fromToken.symbol === "WETH" ? "Arbitrum" : "Monad"}...` 
        } : step
      ));
      
      console.log("🚀 Starting Phase 2: Source escrow deployment");
      const phase2Result = await executePhase2((window as any).orderData); // eslint-disable-line @typescript-eslint/no-explicit-any
      
      setSteps(prev => prev.map((step, index) => 
        index === 1 ? { 
          ...step, 
          status: "completed", 
          text: "Source escrow deployed", 
          txLink: phase2Result.txHash ? getExplorerUrl(phase2Result.txHash, fromToken.symbol === "WETH" ? 421614 : 10143) : ""
        } : step
      ));
      setProgress(75);

      // Phase 3: Deploy destination escrow
      setSteps(prev => prev.map((step, index) => 
        index === 2 ? { 
          ...step, 
          status: "pending", 
          text: `Deploying destination escrow on ${toToken.symbol === "WMON" ? "Monad" : "Arbitrum"}...` 
        } : step
      ));
      
      console.log("🚀 Starting Phase 3: Destination escrow deployment");
      const phase3Result = await executePhase3();
      
      setSteps(prev => prev.map((step, index) => 
        index === 2 ? { 
          ...step, 
          status: "completed", 
          text: "Destination escrow deployed", 
          txLink: phase3Result.txHash ? getExplorerUrl(phase3Result.txHash, toToken.symbol === "WMON" ? 10143 : 421614) : ""
        } : step
      ));
      setProgress(90);

      // Phase 4: Complete withdrawals
      setSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: "pending", text: "Completing withdrawals..." } : step
      ));
      
      console.log("🚀 Starting Phase 4: Final withdrawals");
      const phase4Result = await executePhase4();
      
      setSteps(prev => prev.map((step, index) => 
        index === 3 ? { 
          ...step, 
          status: "completed", 
          text: "Withdrawals completed", 
          txLink: phase4Result.userWithdrawTx ? getExplorerUrl(phase4Result.userWithdrawTx, toToken.symbol === "WMON" ? 10143 : 421614) : ""
        } : step
      ));
      setProgress(100);

      // Add success step with celebration animation
      setTimeout(() => {
        setSteps(prev => [
          ...prev,
          {
            id: "success",
            text: "🎉 Cross-Chain Swap Completed Successfully!",
            status: "completed",
            txLink: "",
          },
        ]);
        setIsSwapping(false);
        setIsLoading(false);
        setSwapSuccess(true);
        setSwapInProgress(false);
        
        // Refresh balances after swap completion
        fetchAndUpdateBalances();
      }, 1000);

      console.log("🎉 Cross-chain swap completed successfully!");

    } catch (error) {
      console.error("❌ Swap failed:", error);
      
      // Get user-friendly error message
      let userMessage = "Transaction failed. ";
      const errorMsg = (error as Error)?.message?.toLowerCase() || "";
      
      if (errorMsg.includes("insufficient") && errorMsg.includes("balance")) {
        userMessage = "Insufficient funds. Please check your wallet balance and try again.";
      } else if (errorMsg.includes("insufficient") && errorMsg.includes("allowance")) {
        userMessage = "Token approval needed. Please try again to auto-approve.";
      } else if (errorMsg.includes("user rejected") || errorMsg.includes("cancelled")) {
        userMessage = "Transaction was cancelled.";
      } else if (errorMsg.includes("network") || errorMsg.includes("connection")) {
        userMessage = "Network error. Please check your connection and try again.";
      } else {
        userMessage = "Transaction failed. Please try again.";
      }
      
      setErrorMessage(userMessage);
      setIsSwapping(false);
      setIsLoading(false);
      setSwapInProgress(false);
      setSwapSuccess(false);
      setShowExecutionModal(false); // Close the modal on error
      
      // Reset steps and progress on error
      setSteps(prev => prev.map(step => ({ ...step, status: "waiting" as const })));
      setProgress(0);
      
      // Clear error message after 8 seconds
      setTimeout(() => {
        setErrorMessage("");
      }, 8000);
    }
  };

  // Remove the old rate variation effect since we're using fixed rates now
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!authenticated) return;
      if (e.key === "Enter" && !isSwapping && parseFloat(fromAmount) > 0) {
        executeSwap();
      }
      if (e.key === "Escape") {
        setShowStatusPanel(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [authenticated, isSwapping, fromAmount]);

  useEffect(() => {
    if (showExecutionModal && showExecutionModal) {
      // Scroll to the modal content
      const modalContent = document.querySelector('.modal-content');
      if (modalContent) {
        modalContent.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [showExecutionModal]);


  // Recalculate toAmount when tokens change
  useEffect(() => {
    if (fromAmount) {
      const amount = parseFloat(fromAmount);
      // Ensure rate is correct based on current token direction
      const correctRate = fromToken.symbol === "WETH" ? 0.9 : (1 / 0.9);
      setCurrentRate(correctRate);
      const calculatedAmount = amount * correctRate;
      setToAmount(calculatedAmount > 0 ? calculatedAmount.toFixed(6) : "0");
    }
  }, [fromToken.symbol, toToken.symbol, fromAmount]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter relative">
      <div className="max-w-md mx-auto px-4 pt-6">
        {!authenticated && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6 text-center border border-gray-700 shadow-sm">
            <p className="text-yellow-400 mb-2 font-medium">
              Please connect your wallet to proceed.
            </p>
          </div>
        )}
        {authenticated && address && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6 text-center border border-gray-700 shadow-sm">
            <p className="text-green-400 mb-2 font-medium">
              Ready for Cross-Chain Swap
            </p>
          </div>
        )}

        {authenticated && (
          <>
            <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <span className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold">
                  ⚡ Cross-Chain
                </span>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <span>Rate: 1 {fromToken.symbol} = {currentRate.toFixed(4)} {toToken.symbol}</span>
                  {isLoading && <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>}
                </div>
              </div>

              <div className="bg-gray-700 rounded-xl p-4 mb-4 border border-gray-600 transition-all duration-200 hover:bg-gray-650 hover:border-gray-500 group">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-300">
                  <span>From</span>
                  <span
                    className="cursor-pointer hover:text-white transition-colors duration-200 font-medium hover:scale-105"
                    onClick={() => setFromAmount(getFromBalance())}
                  >
                    Balance: {getFromBalance()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    className="bg-transparent text-2xl font-semibold w-full text-white placeholder-gray-400 outline-none transition-all duration-200 group-hover:text-blue-100"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={handleAmountInput}
                    disabled={!authenticated}
                  />
                  <div className="flex items-center space-x-2 ml-3 bg-gray-600 rounded-lg px-3 py-2 border border-gray-500">
                    <span className="text-white font-semibold">
                      {fromToken.symbol}
                    </span>
                    <span className="text-blue-300 text-xs font-medium">
                      {fromToken.chain}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mb-4 relative">
                <button
                  className={`relative bg-gray-700 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-300 border border-gray-600 hover:bg-gray-600 hover:scale-110 hover:rotate-180 hover:shadow-lg group ${
                    isSwapButtonHovered ? 'shadow-md' : 'shadow-sm'
                  }`}
                  onClick={swapTokens}
                  disabled={!authenticated}
                  onMouseEnter={() => setIsSwapButtonHovered(true)}
                  onMouseLeave={() => setIsSwapButtonHovered(false)}
                >
                  <svg
                    className={`w-5 h-5 text-gray-300 transition-all duration-300 group-hover:text-white group-hover:scale-110 ${
                      isSwapButtonHovered ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  
                  {/* Hover effect ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/0 group-hover:border-blue-500/50 transition-all duration-300 group-hover:scale-125"></div>
                </button>
              </div>

              <div className="bg-gray-700 rounded-xl p-4 mb-4 border border-gray-600 transition-all duration-200 hover:bg-gray-650 hover:border-gray-500 group">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-300">
                  <span>To</span>
                  <span
                    className="cursor-pointer hover:text-white transition-colors duration-200 font-medium hover:scale-105"
                    onClick={() => setFromAmount(getToBalance())}
                  >
                    Balance: {getToBalance()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    className="bg-transparent text-2xl font-semibold w-full text-white placeholder-gray-400 outline-none transition-all duration-200 group-hover:text-green-100"
                    placeholder="0.0"
                    value={toAmount}
                    readOnly
                    disabled={!authenticated}
                  />
                  <div className="flex items-center space-x-2 ml-3 bg-gray-600 rounded-lg px-3 py-2 border border-gray-500">
                    <span className="text-white font-semibold">
                      {toToken.symbol}
                    </span>
                    <span className="text-green-300 text-xs font-medium">
                      {toToken.chain}
                    </span>
                  </div>
                </div>
              </div>

              {/* Swap Status Indicator */}
              {swapInProgress && !swapSuccess && (
                <div className="bg-blue-900/30 border border-blue-600/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                      <div>
                        <span className="text-blue-300 font-medium">Swap in Progress</span>
                        <p className="text-xs text-blue-200">Your cross-chain swap is running in the background</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowExecutionModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      View Progress
                    </button>
                  </div>
                </div>
              )}

              {/* Swap Success Indicator */}
              {swapSuccess && (
                <div className="bg-green-900/30 border border-green-600/50 rounded-xl p-4 mb-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" />
                      </svg>
                      <div>
                        <span className="text-green-300 font-medium">Swap Completed!</span>
                        <p className="text-xs text-green-200">Your cross-chain swap was successful</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowExecutionModal(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              {/* Network Error Message */}
              {networkError && (
                <div className="bg-orange-900/30 border border-orange-600/50 rounded-xl p-4 mb-4 animate-shake">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-orange-300 font-medium">{networkError}</span>
                  </div>
                </div>
              )}

              {/* Encouragement Message */}
              {encouragementMessage && (
                <div className="bg-green-900/30 border border-green-600/50 rounded-xl p-4 mb-4 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-green-300 font-medium">{encouragementMessage}</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-900/30 border border-red-600/50 rounded-xl p-4 mb-4 animate-shake">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-300 font-medium">{errorMessage}</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-900/30 rounded-xl p-4 mb-6 border border-blue-700/50">
                <div className="flex justify-between text-sm">
                  <div className="text-center">
                    <span className="text-white font-semibold">{isLoading ? '⏳ Processing...' : '~2 min'}</span>
                    <span className="text-gray-400 block text-xs">Est. Time</span>
                  </div>
                  <div className="text-center">
                    <span className="text-white font-semibold">Gasless</span>
                    <span className="text-gray-400 block text-xs">User Fee</span>
                  </div>
                </div>
              </div>

              {/* Info about approval handling */}
              {authenticated && fromAmount && parseFloat(fromAmount) > 0 && (
                <div className="mb-4 p-3 rounded-lg border bg-blue-900/30 border-blue-600/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-300">
                      🔐 Token approval handled automatically
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {fromToken.symbol} approval will be requested during order creation if needed
                  </p>
                </div>
              )}

              <button
                className={`w-full py-4 rounded-xl text-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden ${
                  !authenticated || !fromAmount || networkError
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                    : swapInProgress && !swapSuccess
                    ? "bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] hover:shadow-lg"
                    : "bg-green-600 hover:bg-green-700 text-white hover:scale-[1.02] hover:shadow-lg"
                }`}
                onClick={swapInProgress && !swapSuccess ? () => setShowExecutionModal(true) : executeSwap}
                disabled={!authenticated || isSwapping || !fromAmount || !!networkError}
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                )}
                <span className="relative z-10">
                  {!authenticated
                    ? "Connect Wallet"
                    : networkError
                    ? "Switch Network"
                    : !fromAmount
                    ? "Enter Amount"
                    : isSwapping
                    ? "⏳ Processing Cross-Chain Swap..."
                    : swapInProgress && !swapSuccess
                    ? "🔄 View Progress"
                    : "🚀 Execute Cross-Chain Swap"}
                </span>
              </button>

            </div>

            {/* Execution Modal */}
            {showExecutionModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        {swapSuccess ? (
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2Z" />
                          </svg>
                        )}
                      </div>
                      <h3 className="font-semibold text-xl text-white">
                        {swapSuccess ? "🎉 Swap Completed!" : "Cross-Chain Swap in Progress"}
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowExecutionModal(false)}
                      className="text-gray-400 hover:text-white transition-colors duration-200"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Enhanced Swap Animation */}
                  {!swapSuccess && (
                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        {/* Token swap animation */}
                        <div className="flex items-center space-x-8">
                          {/* From token */}
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg transform hover:scale-105 transition-transform duration-200">
                              {fromToken.symbol}
                            </div>
                          </div>
                          
                          {/* Flowing dots animation */}
                          <div className="flex items-center space-x-1">
                            {[...Array(3)].map((_, i) => (
                              <div
                                key={i}
                                className="w-2 h-2 bg-blue-500 rounded-full animate-flow"
                                style={{
                                  animationDelay: `${i * 0.3}s`,
                                }}
                              />
                            ))}
                          </div>
                          
                          {/* To token */}
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg transform hover:scale-105 transition-transform duration-200">
                              {toToken.symbol}
                            </div>
                          </div>
                        </div>
                        
                      </div>
                    </div>
                  )}

                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-6">
                    <div
                      className={`h-full bg-blue-600 transition-all duration-500 rounded-full ${isLoading ? 'animate-pulse' : ''}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  <div className="flex flex-col gap-4 max-h-64 overflow-y-auto custom-scrollbar">
                    {steps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-4 py-3 animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                            step.status === "completed"
                              ? "bg-blue-600 text-white"
                              : step.status === "pending"
                              ? "bg-yellow-500 text-white animate-spin"
                              : "bg-gray-600 text-gray-300"
                          }`}
                        >
                          {step.status === "completed"
                            ? "✓"
                            : step.status === "pending"
                            ? "⟳"
                            : index + 1}
                        </div>
                        <span
                          className={`flex-1 text-sm transition-all duration-200 ${
                            step.status === "completed"
                              ? "text-white font-medium"
                              : step.status === "pending"
                              ? "text-white font-semibold"
                              : "text-gray-400"
                          }`}
                        >
                          {step.text}
                        </span>
                        {step.txLink && step.status === "completed" && (
                          <a
                            href={step.txLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 text-xs border border-blue-600 px-3 py-1.5 rounded-lg hover:text-blue-200 hover:border-blue-500 hover:bg-blue-600/20 transition-all duration-200"
                          >
                            View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    {swapSuccess ? (
                      <button
                        onClick={() => setShowExecutionModal(false)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-all duration-200"
                      >
                        Close
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowExecutionModal(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-all duration-200"
                      >
                        Minimize
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16 px-4 pb-8">
        <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700 hover:border-gray-600 transition-all duration-200 hover:scale-[1.02] shadow-sm">
          <div className="text-3xl mb-4">⚡</div>
          <h3 className="font-semibold text-lg mb-2 text-white">Gasless Swaps</h3>
          <p className="text-sm text-gray-400">
            No gas fees for users. Resolvers handle all blockchain costs.
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700 hover:border-gray-600 transition-all duration-200 hover:scale-[1.02] shadow-sm">
          <div className="text-3xl mb-4">🔒</div>
          <h3 className="font-semibold text-lg mb-2 text-white">Secure Escrow</h3>
          <p className="text-sm text-gray-400">
            Smart contracts with hashlock/timelock ensure safe atomic swaps.
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700 hover:border-gray-600 transition-all duration-200 hover:scale-[1.02] shadow-sm">
          <div className="text-3xl mb-4">🌉</div>
          <h3 className="font-semibold text-lg mb-2 text-white">Cross-Chain</h3>
          <p className="text-sm text-gray-400">
            Seamless swaps between Ethereum and Monad ecosystems.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-2px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(2px);
          }
        }
        
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(34, 197, 94, 0.6);
          }
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
          }
          40%, 43% {
            transform: translate3d(0,-10px,0);
          }
          70% {
            transform: translate3d(0,-5px,0);
          }
          90% {
            transform: translate3d(0,-2px,0);
          }
        }
        
        @keyframes flow {
          0%, 100% { 
            opacity: 0.3; 
            transform: translateX(-4px) scale(0.8); 
          }
          50% { 
            opacity: 1; 
            transform: translateX(4px) scale(1.2); 
          }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        
        .animate-bounce {
          animation: bounce 1s infinite;
        }
        
        .animate-flow {
          animation: flow 1.5s ease-in-out infinite;
        }
        
        .font-inter {
          font-family: "Inter", sans-serif;
        }

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #3b82f6, #1d4ed8);
          border-radius: 4px;
          border: 1px solid #1f2937;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #60a5fa, #3b82f6);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg, #1d4ed8, #1e40af);
        }
      `}</style>
    </div>
  );
}
