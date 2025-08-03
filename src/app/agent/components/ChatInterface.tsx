"use client";
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GPTResponse } from '../types/agent.types';

interface ChatInterfaceProps {
  isOpen: boolean;
  messages: ChatMessage[];
  isProcessing: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<void>;
  onViewHistory: () => void;
  userAddress?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  isOpen,
  messages,
  isProcessing,
  onClose,
  onSendMessage,
  onViewHistory,
  userAddress
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const message = inputMessage.trim();
    setInputMessage('');
    
    try {
      await onSendMessage(message);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Simple formatting for better readability
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-700 px-1 rounded">$1</code>');
  };

  const getIntentBadge = (intent?: GPTResponse) => {
    if (!intent) return null;

    const badgeColors = {
      start_dca: 'bg-green-600',
      stop_dca: 'bg-red-600',
      view_history: 'bg-blue-600',
      modify_dca: 'bg-yellow-600',
      unclear: 'bg-gray-600'
    };

    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${badgeColors[intent.intent]} ml-2`}>
        {intent.intent.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-end z-40 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">DCA Agent</h3>
              <p className="text-xs text-gray-400">WETH → WMON Auto-Invest</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewHistory}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="View History"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-semibold text-white mb-2">Welcome to DCA Agent!</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                I can help you set up automatic WETH → WMON investments. Try saying:
              </p>
              <div className="mt-4 space-y-2 text-sm text-gray-300">
                <div className="bg-gray-700/50 rounded-lg p-2">
                  "Invest 0.01 WETH every 5 minutes"
                </div>
                <div className="bg-gray-700/50 rounded-lg p-2">
                  "Show my investment history"
                </div>
                <div className="bg-gray-700/50 rounded-lg p-2">
                  "Stop my DCA investment"
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}>
                  <div 
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                  />
                  {message.intent && getIntentBadge(message.intent)}
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-2xl px-4 py-2 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-300">Processing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 p-4">
          {!userAddress && (
            <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
              <p className="text-yellow-300 text-xs">
                Please connect your wallet to use DCA Agent
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={userAddress ? "Type your message..." : "Connect wallet first..."}
              disabled={!userAddress || isProcessing}
              className="flex-1 bg-gray-700 text-white placeholder-gray-400 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !userAddress || isProcessing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-xl px-4 py-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};