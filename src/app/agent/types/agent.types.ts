export interface DCAInvestment {
  id: string;
  amount: string; // WETH amount (user's chosen amount)
  intervalMinutes: number; // Investment frequency in minutes
  nextSwapTime: number; // Unix timestamp
  isActive: boolean;
  createdAt: number; // Unix timestamp
  totalInvested: string; // Total WETH invested so far
  totalReceived: string; // Total WMON received so far
  swapCount: number; // Number of successful swaps
  
  // Stored signature data for automation
  signedOrderData?: {
    order: any; // The signed order object
    signature: string; // User's signature
    secret: string; // Secret for this order
    orderHash: string; // Order hash
    chainId: number; // Chain ID where order was signed
  };
}

export interface SwapHistoryItem {
  id: string;
  timestamp: number; // Unix timestamp
  wethAmount: string; // WETH amount swapped
  wmonReceived: string; // WMON received
  txHash?: string; // Transaction hash
  status: 'success' | 'failed' | 'pending';
  error?: string; // Error message if failed
  phase2TxHash?: string;
  phase3TxHash?: string;
  phase4TxHash?: string;
}

export interface UserDCAData {
  activeInvestments: DCAInvestment[];
  history: SwapHistoryItem[];
  totalInvested: string; // Lifetime total WETH invested
  totalReceived: string; // Lifetime total WMON received
  lastUpdated: number; // Unix timestamp
}

export interface DCADataStructure {
  users: {
    [address: string]: UserDCAData;
  };
  lastBackup: number; // Unix timestamp
  version: string;
}

export interface GPTResponse {
  intent: 'start_dca' | 'stop_dca' | 'view_history' | 'modify_dca' | 'unclear';
  amount?: string; // WETH amount if starting DCA
  intervalMinutes?: number; // Frequency if starting DCA
  confidence: number; // 0-1 confidence score
  message?: string; // Response message for user
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: number;
  intent?: GPTResponse;
}

export interface AgentState {
  isOpen: boolean;
  messages: ChatMessage[];
  isProcessing: boolean;
  hasNotification: boolean;
}

export interface ApprovalCheckResult {
  hasApproval: boolean;
  currentAllowance: string;
  requiredAmount: string;
  needsApproval: boolean;
  hasSufficientBalance?: boolean;
  userBalance?: string;
}