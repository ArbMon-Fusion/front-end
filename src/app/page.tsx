"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import SignOrderButton from "./components/SignOrder";
import { fetchBalances, formatBalance, getBalanceForToken, BalanceInfo } from "./utils/balance";

export default function Home(): React.ReactElement {
  const { wallets, ready } = useWallets();
  const { authenticated } = usePrivy();
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [currentRate, setCurrentRate] = useState<number>(99.87); // 1 ETH = 99.87 MON
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
  const [isSwapButtonHovered, setIsSwapButtonHovered] = useState<boolean>(false);
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
      text: "Escrow contract locked tokens",
      status: "completed",
      txLink: "",
    },
    {
      id: "step2",
      text: "Resolver executing on Monad...",
      status: "waiting",
      txLink: "",
    },
    {
      id: "step3",
      text: "Tokens released to your wallet",
      status: "waiting",
      txLink: "",
    },
    {
      id: "step4",
      text: "Resolver claims escrowed tokens",
      status: "waiting",
      txLink: "",
    },
  ]);
  const statusPanelRef = useRef<HTMLDivElement | null>(null);

  // Get connected wallet details
  const connectedWallet = wallets.find((w) => w.walletClientType !== "privy");
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const address = connectedWallet?.address || embeddedWallet?.address;
  const chainId = connectedWallet?.chainId;

  // Define accepted chain IDs
  const acceptedChains = [421614, 10143]; // Arbitrum Sepolia ID: 421614, Monad ID: 10143 (replace with actual Monad ID)
  const isValidChain =
    typeof chainId === "number" && acceptedChains.includes(chainId);

  // Fetch balances from both networks
  const fetchAndUpdateBalances = async () => {
    if (!authenticated || !address) {
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
      const fetchedBalances = await fetchBalances(address);
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
  }, [authenticated, address]);

  // Refresh balances every 30 seconds
  useEffect(() => {
    if (!authenticated || !address) return;

    const interval = setInterval(() => {
      fetchAndUpdateBalances();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [authenticated, address]);

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
    setToAmount((amount * currentRate).toFixed(4));
  };

  const swapTokens = () => {
    if (!authenticated) return;
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setCurrentRate(fromToken.symbol === "WETH" ? 99.87 : 0.01002);
    if (fromAmount) {
      setToAmount(
        (
          parseFloat(fromAmount) *
          (fromToken.symbol === "WETH" ? 99.87 : 0.01002)
        ).toFixed(4)
      );
    }
  };

  const generateTxHash = (): string => {
    const chars = "0123456789abcdef";
    let result = "0x";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + "...c3d4";
  };

  const generateTxLink = (stepIndex: number): string => {
    const explorers = [
      "https://sepolia.arbiscan.io/tx/",
      "https://monadscan.com/tx/",
      "https://monadscan.com/tx/",
      "https://sepolia.arbiscan.io/tx/",
    ];
    return (
      explorers[stepIndex] +
      generateTxHash().replace("...c3d4", "c3d4abcd1234567890")
    );
  };

  const simulateSwapProcess = async () => {
    if (!authenticated) return;
    setIsSwapping(true);
    setShowStatusPanel(true);

    const stepUpdates = [
      { progress: 25, text: "Escrow contract locked tokens" },
      { progress: 50, text: "Resolver executing on Monad..." },
      { progress: 75, text: "Tokens released to your wallet" },
      { progress: 100, text: "Resolver claims escrowed tokens" },
    ];

    for (let i = 0; i < stepUpdates.length; i++) {
      const newSteps = [...steps];
      newSteps[i].status = "pending";
      newSteps[i].text = stepUpdates[i].text;
      setSteps(newSteps);
      setProgress(stepUpdates[i].progress);
      await new Promise((resolve) =>
        setTimeout(resolve, 2000 + Math.random() * 2000)
      );
      newSteps[i].status = "completed";
      newSteps[i].txLink = i < stepUpdates.length - 1 ? generateTxLink(i) : "";
      setSteps([...newSteps]);
    }

    setTimeout(() => {
      setSteps((prevSteps) => [
        ...prevSteps,
        {
          id: "success",
          text: "🎉 Cross-Chain Swap Completed!",
          status: "completed",
          txLink: "",
        },
      ]);
      setIsSwapping(false);
      // Refresh balances after swap completion
      fetchAndUpdateBalances();
    }, 1000);
  };

  const executeSwap = () => {
    if (!authenticated || isSwapping || !fromAmount) return;
    simulateSwapProcess();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!authenticated || isSwapping) return;
      const variation = (Math.random() - 0.5) * 0.02;
      setCurrentRate((prev) => {
        const newRate = prev * (1 + variation);
        if (fromAmount) {
          setToAmount((parseFloat(fromAmount) * newRate).toFixed(4));
        }
        return newRate;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [authenticated, isSwapping, fromAmount]);

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
    if (showStatusPanel && statusPanelRef.current) {
      statusPanelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [showStatusPanel]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter relative">
      <div className="max-w-md mx-auto px-4 pt-8">
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
              Cross-Chain Swap WETH ↔ WMON
            </p>
          </div>
        )}
        {authenticated && (
          <>
            <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <span className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold">
                  ⚡ Gasless
                </span>
                <div className="text-xs text-gray-400">
                  Rate: 1 {fromToken.symbol} = {currentRate.toFixed(4)} {toToken.symbol}
                </div>
              </div>

              <div className="bg-gray-700 rounded-xl p-4 mb-4 border border-gray-600 transition-all duration-200 hover:bg-gray-650">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-300">
                  <span>From</span>
                  <span
                    className="cursor-pointer hover:text-white transition-colors duration-200 font-medium"
                    onClick={() => setFromAmount(getFromBalance())}
                  >
                    Balance: {getFromBalance()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    className="bg-transparent text-2xl font-semibold w-full text-white placeholder-gray-400 outline-none"
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
                  className={`relative bg-gray-700 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200 border border-gray-600 hover:bg-gray-600 hover:scale-105 ${isSwapButtonHovered ? 'shadow-md' : 'shadow-sm'
                    }`}
                  onClick={swapTokens}
                  disabled={!authenticated}
                  onMouseEnter={() => setIsSwapButtonHovered(true)}
                  onMouseLeave={() => setIsSwapButtonHovered(false)}
                >
                  <svg
                    className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${isSwapButtonHovered ? 'rotate-180' : ''
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-700 rounded-xl p-4 mb-4 border border-gray-600 transition-all duration-200 hover:bg-gray-650">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-300">
                  <span>To</span>
                  <span
                    className="cursor-pointer hover:text-white transition-colors duration-200 font-medium"
                    onClick={() => setFromAmount(getToBalance())}
                  >
                    Balance: {getToBalance()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    className="bg-transparent text-2xl font-semibold w-full text-white placeholder-gray-400 outline-none"
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

              <div className="bg-blue-900/30 rounded-xl p-4 mb-6 border border-blue-700/50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-blue-200">Best Route via Fusion+</span>
                  <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    Best Rate
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <div className="text-center">
                    <span className="text-white font-semibold">~30s</span>
                    <span className="text-gray-400 block text-xs">Est. Time</span>
                  </div>
                  <div className="text-center">
                    <span className="text-white font-semibold">$0.00</span>
                    <span className="text-gray-400 block text-xs">Gas Fee</span>
                  </div>
                </div>
              </div>

              <button
                className={`w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${isSwapping || !fromAmount
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-700 hover:scale-[1.02]"
                  }`}
                onClick={executeSwap}
                disabled={!authenticated || isSwapping || !fromAmount}
              >
                {isSwapping
                  ? "⏳ Swapping..."
                  : fromAmount
                    ? "🚀 Submit order"
                    : "Enter Amount"}
              </button>
              <SignOrderButton />

            </div>

            <div
              ref={statusPanelRef}
              className={`bg-gray-800 rounded-2xl p-6 mt-6 border border-gray-700 shadow-sm transition-all duration-300 ${showStatusPanel ? "block opacity-100 translate-y-0" : "hidden opacity-0 translate-y-2"
                }`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  {steps.some((step) => step.text.includes("Completed")) ? (
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-white animate-pulse"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2Z" />
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold text-xl text-white">
                  {steps.some((step) => step.text.includes("Completed"))
                    ? "🎉 Cross-Chain Swap Completed!"
                    : "Cross-Chain Swap in Progress"}
                </h3>
              </div>

              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-6">
                <div
                  className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="flex flex-col gap-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-4 py-3 animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${step.status === "completed"
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
                      className={`flex-1 text-sm transition-all duration-200 ${step.status === "completed"
                          ? "text-white font-medium"
                          : step.status === "pending"
                            ? "text-white font-semibold"
                            : "text-gray-400"
                        }`}
                    >
                      {step.text}
                    </span>
                    {step.txLink && (
                      <a
                        href={step.txLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-300 text-xs border border-blue-600 px-3 py-1.5 rounded-lg hover:text-blue-200 hover:border-blue-500 hover:bg-blue-600/20 transition-all duration-200"
                      >
                        {step.txLink
                          ? (step.txLink.split("/").pop() ?? "").substring(
                            0,
                            10
                          ) + "..."
                          : ""}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        .font-inter {
          font-family: "Inter", sans-serif;
        }
      `}</style>
    </div>
  );
}
