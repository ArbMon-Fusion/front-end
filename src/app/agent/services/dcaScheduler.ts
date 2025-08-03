"use client";
import { DataManager } from './dataManager';
import { DCAInvestment, SwapHistoryItem } from '../types/agent.types';
import { createCrossChainOrder, signCrossChainOrder } from '../../utils/createCrossChainOrder';
import { executePhase2, executePhase3, executePhase4 } from '../../utils/resolverOperations';
import { checkAndRequestApproval, getLOPContract, getTokenAddress } from '../../utils/tokenApproval';
import { parseUnits, Wallet, JsonRpcProvider } from 'ethers';
import contractAddresses from '../../../../deployedAddresses/addresses.json';

export class DCAScheduler {
  private static instance: DCAScheduler;
  private dataManager: DataManager;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

  private constructor() {
    this.dataManager = DataManager.getInstance();
  }

  public static getInstance(): DCAScheduler {
    if (!DCAScheduler.instance) {
      DCAScheduler.instance = new DCAScheduler();
    }
    return DCAScheduler.instance;
  }

  public start(): void {
    if (this.isRunning) {
      console.log('DCA Scheduler is already running');
      return;
    }

    console.log('🚀 Starting DCA Scheduler...');
    this.isRunning = true;

    // Start checking for due investments
    this.intervalId = setInterval(() => {
      this.checkAndExecuteDueInvestments();
    }, this.CHECK_INTERVAL);

    // Run initial check
    this.checkAndExecuteDueInvestments();
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log('DCA Scheduler is not running');
      return;
    }

    console.log('⏹️ Stopping DCA Scheduler...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAndExecuteDueInvestments(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ DCA Scheduler not running, skipping check');
      return;
    }

    try {
      console.log('🔍 Checking for due DCA investments...');
      console.log('⏰ Current timestamp:', Date.now());
      
      // Load latest data
      await this.dataManager.loadData();
      
      // Get investments that are due for execution
      const dueInvestments = this.dataManager.getInvestmentsDue();
      
      console.log(`📋 Total investments found: ${dueInvestments.length}`);
      
      // Debug: Show all investments with their next swap times
      dueInvestments.forEach(({ address, investment }) => {
        console.log(`👤 User: ${address}`);
        console.log(`💰 Amount: ${investment.amount} WETH`);
        console.log(`⏰ Next swap: ${investment.nextSwapTime} (${new Date(investment.nextSwapTime).toISOString()})`);
        console.log(`✅ Active: ${investment.isActive}`);
        console.log(`🔄 Due now: ${investment.nextSwapTime <= Date.now()}`);
      });
      
      if (dueInvestments.length === 0) {
        console.log('ℹ️ No investments due for execution');
        return;
      }

      console.log(`📊 Found ${dueInvestments.length} investments due for execution`);

      // Execute each due investment
      for (const { address, investment } of dueInvestments) {
        console.log(`🚀 Executing investment for ${address}: ${investment.amount} WETH`);
        await this.executeInvestment(address, investment);
      }

    } catch (error) {
      console.error('❌ Error checking due investments:', error);
    }
  }

  private async executeInvestment(userAddress: string, investment: DCAInvestment): Promise<void> {
    const historyId = Date.now().toString();
    
    try {
      console.log(`🔄 Starting DCA investment execution for ${userAddress}: ${investment.amount} WETH`);

      // Create pending history item
      const pendingHistory: SwapHistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        wethAmount: investment.amount,
        wmonReceived: "0",
        status: 'pending'
      };

      await this.dataManager.addHistoryItem(userAddress, pendingHistory);

      // Step 1: Use stored signature data (no need to create new order)
      console.log('1️⃣ Using stored signed order data...');
      
      if (!investment.signedOrderData) {
        throw new Error('No signed order data found. User needs to sign DCA order first.');
      }

      // Use the stored signed order data directly
      const completeOrderData = {
        order: investment.signedOrderData.order,
        signature: investment.signedOrderData.signature,
        secret: investment.signedOrderData.secret,
        orderHash: investment.signedOrderData.orderHash,
        swapDirection: "WETH_TO_WMON" as const,
        chainId: investment.signedOrderData.chainId
      };

      console.log('✅ Using stored user signature for DCA automation');
      console.log('📋 Order hash:', completeOrderData.orderHash);
      console.log('✍️ Signature:', completeOrderData.signature.substring(0, 10) + '...');

      // Step 3: Execute Phase 2 - Deploy source escrow (Arbitrum)
      console.log('3️⃣ Executing Phase 2: Source escrow deployment...');
      const phase2Result = await executePhase2(completeOrderData);
      console.log(`✅ Phase 2 completed: ${phase2Result.txHash}`);

      // Step 4: Execute Phase 3 - Deploy destination escrow (Monad)
      console.log('4️⃣ Executing Phase 3: Destination escrow deployment...');
      const phase3Result = await executePhase3();
      console.log(`✅ Phase 3 completed: ${phase3Result.txHash}`);

      // Step 5: Execute Phase 4 - Complete withdrawals
      console.log('5️⃣ Executing Phase 4: Final withdrawals...');
      const phase4Result = await executePhase4();
      console.log(`✅ Phase 4 completed: ${phase4Result.userWithdrawTx}`);

      // Calculate received WMON (using 0.9 rate from your existing system)
      const wmonReceived = (parseFloat(investment.amount) * 0.9).toString();

      // Update successful history
      const successHistory: SwapHistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        wethAmount: investment.amount,
        wmonReceived,
        status: 'success',
        txHash: phase4Result.userWithdrawTx,
        phase2TxHash: phase2Result.txHash,
        phase3TxHash: phase3Result.txHash,
        phase4TxHash: phase4Result.userWithdrawTx
      };

      await this.dataManager.updateHistoryItem(userAddress, historyId, successHistory);

      // Update investment statistics
      const updatedInvestment: Partial<DCAInvestment> = {
        totalInvested: (parseFloat(investment.totalInvested) + parseFloat(investment.amount)).toString(),
        totalReceived: (parseFloat(investment.totalReceived) + parseFloat(wmonReceived)).toString(),
        swapCount: investment.swapCount + 1,
        nextSwapTime: Date.now() + (1 * 60 * 1000) // Next swap in 1 minute (testing)
      };

      await this.dataManager.updateInvestment(userAddress, investment.id, updatedInvestment);

      console.log(`🎉 DCA investment executed successfully for ${userAddress}`);
      console.log(`💰 Real Swap Completed: ${investment.amount} WETH → ${wmonReceived} WMON`);

    } catch (error) {
      console.error(`❌ Failed to execute DCA investment for ${userAddress}:`, error);

      // Update failed history
      const failedHistory: SwapHistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        wethAmount: investment.amount,
        wmonReceived: "0",
        status: 'failed',
        error: (error as Error).message
      };

      await this.dataManager.updateHistoryItem(userAddress, historyId, failedHistory);

      // Schedule retry (next attempt in 1 minute for testing)
      const retryInvestment: Partial<DCAInvestment> = {
        nextSwapTime: Date.now() + (1 * 60 * 1000)
      };

      await this.dataManager.updateInvestment(userAddress, investment.id, retryInvestment);
    }
  }

  private getResolverWallet(): Wallet | null {
    // Get resolver private key from environment
    const resolverPK = process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY;
    
    if (!resolverPK) {
      console.error('❌ NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY not found in environment');
      return null;
    }

    try {
      // Create a proper Wallet instance (same as in resolverOperations.ts line 142)
      // Use Arbitrum provider since we're signing WETH_TO_WMON orders on Arbitrum
      const arbitrumProvider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_ARB_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        421614, // Arbitrum Sepolia
        {
          cacheTimeout: -1,
          staticNetwork: true
        }
      );

      const resolverWallet = new Wallet(resolverPK, arbitrumProvider);
      console.log('✅ Resolver wallet created successfully');
      return resolverWallet;

    } catch (error) {
      console.error('❌ Error creating resolver wallet:', error);
      return null;
    }
  }

  private async checkTokenApproval(userAddress: string, amount: string): Promise<{
    hasApproval: boolean;
    currentAllowance: string;
    requiredAmount: string;
  }> {
    try {
      console.log(`🔐 Checking WETH approval for ${userAddress}: ${amount} WETH`);
      
      // Use the real approval checker service
      const { ApprovalChecker } = await import('./approvalChecker');
      const approvalChecker = ApprovalChecker.getInstance();
      
      const approvalResult = await approvalChecker.checkWETHApproval(userAddress, amount);
      
      return {
        hasApproval: approvalResult.hasApproval,
        currentAllowance: (parseFloat(approvalResult.currentAllowance) / 1e18).toString(),
        requiredAmount: amount
      };

    } catch (error) {
      console.error('Error checking token approval:', error);
      return {
        hasApproval: false,
        currentAllowance: "0",
        requiredAmount: amount
      };
    }
  }

  // Get scheduler status
  public getStatus(): {
    isRunning: boolean;
    nextCheck: number;
    activeInvestments: number;
  } {
    let activeInvestments = 0;
    
    try {
      const dueInvestments = this.dataManager.getInvestmentsDue();
      activeInvestments = dueInvestments.length;
    } catch (error) {
      console.error('Error getting active investments:', error);
    }

    return {
      isRunning: this.isRunning,
      nextCheck: Date.now() + this.CHECK_INTERVAL,
      activeInvestments
    };
  }

  // Manual trigger for testing
  public async triggerManualCheck(): Promise<void> {
    console.log('🔧 Manual trigger: Checking for due investments...');
    await this.checkAndExecuteDueInvestments();
  }
}

// Auto-start scheduler when module loads (for demo)
if (typeof window !== 'undefined') {
  // Only start in browser environment
  const scheduler = DCAScheduler.getInstance();
  
  // Make scheduler available globally for debugging
  (window as any).dcaScheduler = scheduler;
  
  // Start scheduler after a short delay to ensure app is loaded
  setTimeout(() => {
    console.log('🤖 Auto-starting DCA Scheduler...');
    scheduler.start();
    console.log('🟢 DCA Scheduler status:', scheduler.getStatus());
  }, 5000); // Start after 5 seconds
}
