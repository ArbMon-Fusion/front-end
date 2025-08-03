"use client";
import React from 'react';

interface AgentIconProps {
  onClick: () => void;
  hasNotification: boolean;
  isProcessing: boolean;
}

export const AgentIcon: React.FC<AgentIconProps> = ({ 
  onClick, 
  hasNotification, 
  isProcessing 
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onClick}
        className={`
          relative w-14 h-14 rounded-full shadow-lg transform transition-all duration-300 hover:scale-110
          ${isProcessing 
            ? 'bg-blue-600 hover:bg-blue-700 animate-pulse' 
            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
          }
          focus:outline-none focus:ring-4 focus:ring-blue-300/50
        `}
        aria-label="Open DCA Agent"
      >
        {/* Chat Icon */}
        <div className="flex items-center justify-center w-full h-full">
          {isProcessing ? (
            <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </div>

        {/* Notification Badge */}
        {hasNotification && !isProcessing && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        )}

        {/* Ripple Effect on Click */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-0 rounded-full border-2 border-white/0 hover:border-white/30 transition-all duration-300" />
        </div>

        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 blur-xl scale-150 opacity-0 hover:opacity-100 transition-all duration-300" />
      </button>

      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-800 text-white text-sm rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
        {isProcessing ? 'Processing DCA...' : 'DCA Agent'}
        <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
};