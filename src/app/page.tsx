"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWallets, usePrivy } from "@privy-io/react-auth";

export default function Home(): React.ReactElement {
  const { wallets, ready } = useWallets();
  const { authenticated } = usePrivy();
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [currentRate, setCurrentRate] = useState<number>(99.87); // 1 ETH = 99.87 MON
  const [fromBalance, setFromBalance] = useState<string>("0.00");
  const [toBalance, setToBalance] = useState<string>("0.00");
  const [fromToken, setFromToken] = useState<{ symbol: string; chain: string }>(
    { symbol: "ETH", chain: "Ethereum" }
  );
  const [toToken, setToToken] = useState<{ symbol: string; chain: string }>({
    symbol: "MON",
    chain: "Monad",
  });
  const [showStatusPanel, setShowStatusPanel] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
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

  // Update balances based on wallet connection
  useEffect(() => {
    if (authenticated && address) {
      // Placeholder: Fetch real balances (replace with actual API call)
      setFromBalance("2.4567"); // Example ETH balance
      setToBalance("5678.90"); // Example MON balance
    } else {
      setFromBalance("0.00");
      setToBalance("0.00");
    }
  }, [authenticated, address]);

  const updateBalances = () => {
    if (authenticated && address) {
      setFromBalance(fromToken.symbol === "ETH" ? "2.4567" : "5678.90");
      setToBalance(toToken.symbol === "MON" ? "5678.90" : "2.4567");
    }
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
    setCurrentRate(fromToken.symbol === "ETH" ? 99.87 : 0.01002);
    updateBalances();
    if (fromAmount) {
      setToAmount(
        (
          parseFloat(fromAmount) *
          (fromToken.symbol === "ETH" ? 99.87 : 0.01002)
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
    updateBalances();
  }, [fromToken, toToken]);

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
      {/* <div className="text-center py-10">
        <p className="text-sm text-gray-400">
          Gasless Cross-Chain Swaps • Ethereum ↔ Monad
        </p>
      </div> */}

      <div className="max-w-md mx-auto px-4">
        {!authenticated && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
            <p className="text-yellow-400 mb-2">
              Please connect your wallet to proceed.
            </p>
          </div>
        )}
        {authenticated && address && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
            <p className="text-green-400 mb-2">
              Connected: {address.slice(0, 6)}...{address.slice(-4)}
              {/* {!isValidChain && (
                <span className="text-red-500 text-xs ml-2">
                  Switch to Arbitrum Sepolia or Monad.
                </span>
              )} */}
            </p>
          </div>
        )}
        {authenticated && (
          <>
            <div className="bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Cross-Chain Swap</h2>
                <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                  ⚡ Gasless
                </span>
              </div>

              <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4 mb-4 border border-blue-500">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-400">
                  <span>From</span>
                  <span
                    className="cursor-pointer hover:text-white"
                    onClick={() => setFromAmount(fromBalance)}
                  >
                    Balance: {fromBalance}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    className="bg-transparent text-2xl font-semibold w-full text-white placeholder-gray-500 outline-none"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={handleAmountInput}
                    disabled={!authenticated}
                  />
                  <div className="flex items-center space-x-2 ml-2">
                    <span className="text-white font-medium">
                      {fromToken.symbol}
                    </span>
                    <span className="text-blue-400 text-xs">
                      {fromToken.chain}
                    </span>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 12 12"
                    >
                      <path d="M6 9L1.5 4.5L2.91 3.09L6 6.18L9.09 3.09L10.5 4.5L6 9Z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mb-4">
                <button
                  className="bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-600 transition-colors"
                  onClick={swapTokens}
                  disabled={!authenticated}
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M7 14l5-5 5 5H7z" />
                    <path d="M7 10l5 5 5-5H7z" />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4 mb-4 border border-blue-500">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-400">
                  <span>To</span>
                  <span
                    className="cursor-pointer hover:text-white"
                    onClick={() => setFromAmount(toBalance)}
                  >
                    Balance: {toBalance}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    className="bg-transparent text-2xl font-semibold w-full text-white placeholder-gray-500 outline-none"
                    placeholder="0.0"
                    value={toAmount}
                    readOnly
                    disabled={!authenticated}
                  />
                  <div className="flex items-center space-x-2 ml-2">
                    <span className="text-white font-medium">
                      {toToken.symbol}
                    </span>
                    <span className="text-blue-400 text-xs">
                      {toToken.chain}
                    </span>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 12 12"
                    >
                      <path d="M6 9L1.5 4.5L2.91 3.09L6 6.18L9.09 3.09L10.5 4.5L6 9Z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4 mb-4 border border-blue-500">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-400">
                  <span>Best Route via Fusion+</span>
                  <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
                    Best Rate
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <div className="text-center">
                    <span className="text-white font-medium">
                      1 {fromToken.symbol} = {currentRate.toFixed(2)}{" "}
                      {toToken.symbol}
                    </span>
                    <span className="text-gray-400">Exchange Rate</span>
                  </div>
                  <div className="text-center">
                    <span className="text-white font-medium">~30s</span>
                    <span className="text-gray-400">Est. Time</span>
                  </div>
                  <div className="text-center">
                    <span className="text-white font-medium">$0.00</span>
                    <span className="text-gray-400">Gas Fee</span>
                  </div>
                </div>
              </div>

              <button
                className={`w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold ${
                  isSwapping || !fromAmount
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-700"
                }`}
                onClick={executeSwap}
                disabled={!authenticated || isSwapping || !fromAmount}
              >
                {isSwapping
                  ? "⏳ Swapping..."
                  : fromAmount
                  ? "🚀 Execute Gasless Swap"
                  : "Enter Amount"}
              </button>
            </div>

            <div
              ref={statusPanelRef}
              className={`bg-gray-800 rounded-2xl p-6 mt-4 ${
                showStatusPanel ? "block" : "hidden"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  {steps.some((step) => step.text.includes("Completed")) ? (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2Z" />
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold text-lg">
                  {steps.some((step) => step.text.includes("Completed"))
                    ? "🎉 Cross-Chain Swap Completed!"
                    : "Cross-Chain Swap in Progress"}
                </h3>
              </div>

              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="flex flex-col gap-3">
                {steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 py-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                        step.status === "completed"
                          ? "bg-blue-600 text-white"
                          : step.status === "pending"
                          ? "bg-yellow-500 text-white animate-spin"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {step.status === "completed"
                        ? "✓"
                        : step.status === "pending"
                        ? "⟳"
                        : step.id.charAt(step.id.length - 1)}
                    </div>
                    <span
                      className={`flex-1 text-sm ${
                        step.status === "completed"
                          ? "text-white"
                          : step.status === "pending"
                          ? "text-white font-medium"
                          : "text-gray-400"
                      }`}
                    >
                      {step.text}
                    </span>
                    {step.txLink && (
                      <a
                        href={step.txLink}
                        className="text-blue-400 text-xs border border-blue-400 border-opacity-30 px-2 py-1 rounded-md hover:text-blue-300 hover:border-blue-300 transition-all duration-200"
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

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-5 max-w-4xl mx-auto mt-10 px-4">
        <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 text-center hover:bg-gray-700 transition-colors">
          <div className="text-2xl mb-2">⚡</div>
          <h3 className="font-semibold">Gasless Swaps</h3>
          <p className="text-sm text-gray-400">
            No gas fees for users. Resolvers handle all blockchain costs.
          </p>
        </div>
        <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 text-center hover:bg-gray-700 transition-colors">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="font-semibold">Secure Escrow</h3>
          <p className="text-sm text-gray-400">
            Smart contracts with hashlock/timelock ensure safe atomic swaps.
          </p>
        </div>
        <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 text-center hover:bg-gray-700 transition-colors">
          <div className="text-2xl mb-2">🌉</div>
          <h3 className="font-semibold">Cross-Chain</h3>
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
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .font-inter {
          font-family: "Inter", sans-serif;
        }
      `}</style>
    </div>
  );
}
