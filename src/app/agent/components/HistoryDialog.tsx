"use client";
import React, { useState } from 'react';
import { SwapHistoryItem, DCAInvestment } from '../types/agent.types';

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: SwapHistoryItem[];
  activeInvestments: DCAInvestment[];
  userStats: {
    totalInvestments: number;
    activeInvestments: number;
    totalSwaps: number;
    successfulSwaps: number;
    failedSwaps: number;
    pendingSwaps: number;
    totalInvested: string;
    totalReceived: string;
    averageReturn: string;
  };
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({
  isOpen,
  onClose,
  history,
  activeInvestments,
  userStats
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'investments'>('history');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'pending'>('all');

  if (!isOpen) return null;

  const filteredHistory = history.filter(item => 
    filterStatus === 'all' || item.status === filterStatus
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'failed':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      case 'pending':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  const getExplorerUrl = (txHash: string) => {
    // Default to Arbitrum Sepolia for WETH transactions
    return `https://sepolia.arbiscan.io/tx/${txHash}`;
  };

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toFixed(6);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatNextSwap = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Due now';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">DCA Dashboard</h2>
            <p className="text-gray-400">Manage your WETH → WMON investments</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">{userStats.totalInvested}</div>
              <div className="text-sm text-gray-400">Total WETH Invested</div>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-400">{userStats.totalReceived}</div>
              <div className="text-sm text-gray-400">Total WMON Received</div>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-400">{userStats.successfulSwaps}</div>
              <div className="text-sm text-gray-400">Successful Swaps</div>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-400">{userStats.averageReturn}</div>
              <div className="text-sm text-gray-400">Average Return</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Swap History ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('investments')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'investments'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Active Investments ({activeInvestments.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'history' ? (
            <div className="h-full flex flex-col">
              {/* Filter */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex gap-2">
                  {(['all', 'success', 'failed', 'pending'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        filterStatus === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* History List */}
              <div className="flex-1 overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No swap history found</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {filteredHistory.map((item) => (
                      <div key={item.id} className="bg-gray-700/50 rounded-xl p-4 hover:bg-gray-700/70 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(item.status)}
                            <div>
                              <div className="text-white font-medium">
                                {formatAmount(item.wethAmount)} WETH → {formatAmount(item.wmonReceived)} WMON
                              </div>
                              <div className="text-sm text-gray-400">
                                {formatDate(item.timestamp)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.status === 'success' ? 'bg-green-600/20 text-green-400' :
                              item.status === 'failed' ? 'bg-red-600/20 text-red-400' :
                              'bg-yellow-600/20 text-yellow-400'
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                            {item.txHash && (
                              <a
                                href={getExplorerUrl(item.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                View TX
                              </a>
                            )}
                          </div>
                        </div>
                        {item.error && (
                          <div className="mt-2 text-sm text-red-400 bg-red-900/20 rounded-lg p-2">
                            {item.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              {activeInvestments.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p>No active DCA investments</p>
                    <p className="text-sm mt-2">Start your first investment in the chat!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeInvestments.map((investment) => (
                    <div key={investment.id} className="bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${investment.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <div>
                            <div className="text-white font-medium">
                              {investment.amount} WETH every {Math.floor(investment.intervalMinutes / 60) > 0 ? 
                                `${Math.floor(investment.intervalMinutes / 60)}h` : 
                                `${investment.intervalMinutes}m`}
                            </div>
                            <div className="text-sm text-gray-400">
                              Next swap: {formatNextSwap(investment.nextSwapTime)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-medium">{investment.swapCount} swaps</div>
                          <div className="text-sm text-gray-400">completed</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400">Total Invested</div>
                          <div className="text-white font-medium">{formatAmount(investment.totalInvested)} WETH</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Total Received</div>
                          <div className="text-white font-medium">{formatAmount(investment.totalReceived)} WMON</div>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="text-xs text-gray-400">
                          Created: {formatDate(investment.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};