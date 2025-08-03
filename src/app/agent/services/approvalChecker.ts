"use client";
import { Contract, JsonRpcProvider, parseUnits } from 'ethers';
import { ApprovalCheckResult } from '../types/agent.types';
import contractAddresses from '../../../../deployedAddresses/addresses.json';

export class ApprovalChecker {
  private static instance: ApprovalChecker;
  
  // Chain configurations
  private readonly chains = {
    arbitrum: {
      rpc: process.env.NEXT_PUBLIC_ARB_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      wethAddress: contractAddresses.contractAddresses.arbitrum.WETH,
      lopAddress: contractAddresses.contractAddresses.arbitrum.limitOrderProtocol
    },
    monad: {
      rpc: process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
      chainId: 10143,
      wmonAddress: contractAddresses.contractAddresses.monad.WMON,
      lopAddress: contractAddresses.contractAddresses.monad.limitOrderProtocol
    }
  };

  private constructor() {}

  public static getInstance(): ApprovalChecker {
    if (!ApprovalChecker.instance) {
      ApprovalChecker.instance = new ApprovalChecker();
    }
    return ApprovalChecker.instance;
  }

  /**
   * Check WETH approval for DCA investments (always on Arbitrum for WETH → WMON swaps)
   */
  public async checkWETHApproval(
    userAddress: string, 
    requiredAmount: string
  ): Promise<ApprovalCheckResult> {
    try {
      console.log(`🔐 Checking WETH approval for ${userAddress}: ${requiredAmount} WETH`);

      const provider = new JsonRpcProvider(this.chains.arbitrum.rpc, this.chains.arbitrum.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
      });

      const wethContract = new Contract(
        this.chains.arbitrum.wethAddress,
        [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function balanceOf(address account) view returns (uint256)'
        ],
        provider
      );

      // Check current allowance
      const currentAllowance = await wethContract.allowance(
        userAddress,
        this.chains.arbitrum.lopAddress
      );

      // Check user balance
      const userBalance = await wethContract.balanceOf(userAddress);

      const requiredAmountBN = parseUnits(requiredAmount, 18);
      const hasApproval = currentAllowance >= requiredAmountBN;
      const hasSufficientBalance = userBalance >= requiredAmountBN;

      console.log(`💰 WETH Balance: ${userBalance.toString()}`);
      console.log(`🎫 Current Allowance: ${currentAllowance.toString()}`);
      console.log(`📊 Required Amount: ${requiredAmountBN.toString()}`);
      console.log(`✅ Has Approval: ${hasApproval}`);
      console.log(`💰 Has Balance: ${hasSufficientBalance}`);

      return {
        hasApproval,
        currentAllowance: currentAllowance.toString(),
        requiredAmount: requiredAmountBN.toString(),
        needsApproval: !hasApproval,
        hasSufficientBalance,
        userBalance: userBalance.toString()
      } as ApprovalCheckResult & { hasSufficientBalance: boolean; userBalance: string };

    } catch (error) {
      console.error('❌ Error checking WETH approval:', error);
      
      return {
        hasApproval: false,
        currentAllowance: "0",
        requiredAmount: parseUnits(requiredAmount, 18).toString(),
        needsApproval: true,
        hasSufficientBalance: false,
        userBalance: "0"
      } as ApprovalCheckResult & { hasSufficientBalance: boolean; userBalance: string };
    }
  }

  /**
   * Check if user needs to approve tokens before starting DCA
   */
  public async checkDCAReadiness(
    userAddress: string,
    investmentAmount: string,
    totalInvestments: number = 10 // Estimate how many investments user might make
  ): Promise<{
    isReady: boolean;
    issues: string[];
    recommendations: string[];
    approvalNeeded: boolean;
    estimatedRequiredApproval: string;
  }> {
    try {
      // Calculate estimated total amount needed (investment amount × estimated number of swaps)
      const estimatedTotalAmount = (parseFloat(investmentAmount) * totalInvestments).toString();
      
      const approvalResult = await this.checkWETHApproval(userAddress, estimatedTotalAmount);
      
      const issues: string[] = [];
      const recommendations: string[] = [];
      let isReady = true;

      // Check balance
      if (!approvalResult.hasSufficientBalance) {
        issues.push(`Insufficient WETH balance. You have ${parseFloat(approvalResult.userBalance || "0") / 1e18} WETH, but need at least ${investmentAmount} WETH for the first investment.`);
        recommendations.push(`Deposit more WETH or reduce investment amount.`);
        isReady = false;
      }

      // Check approval
      if (!approvalResult.hasApproval) {
        issues.push(`Insufficient WETH approval for automated swaps.`);
        recommendations.push(`Approve ${estimatedTotalAmount} WETH (or more) to Limit Order Protocol for seamless DCA execution.`);
        isReady = false;
      }

      // Additional recommendations for optimal DCA
      if (parseFloat(approvalResult.currentAllowance) / 1e18 < parseFloat(estimatedTotalAmount)) {
        recommendations.push(`Consider approving a larger amount to avoid frequent approval transactions.`);
      }

      return {
        isReady,
        issues,
        recommendations,
        approvalNeeded: !approvalResult.hasApproval,
        estimatedRequiredApproval: estimatedTotalAmount
      };

    } catch (error) {
      console.error('❌ Error checking DCA readiness:', error);
      
      return {
        isReady: false,
        issues: ['Failed to check wallet readiness. Please try again.'],
        recommendations: ['Ensure your wallet is connected and try again.'],
        approvalNeeded: true,
        estimatedRequiredApproval: investmentAmount
      };
    }
  }

  /**
   * Get user's WETH balance and allowance info
   */
  public async getWETHInfo(userAddress: string): Promise<{
    balance: string;
    balanceFormatted: string;
    allowance: string;
    allowanceFormatted: string;
    isApproved: boolean;
  }> {
    try {
      const provider = new JsonRpcProvider(this.chains.arbitrum.rpc, this.chains.arbitrum.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
      });

      const wethContract = new Contract(
        this.chains.arbitrum.wethAddress,
        [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function balanceOf(address account) view returns (uint256)'
        ],
        provider
      );

      const [balance, allowance] = await Promise.all([
        wethContract.balanceOf(userAddress),
        wethContract.allowance(userAddress, this.chains.arbitrum.lopAddress)
      ]);

      const balanceFormatted = (parseFloat(balance.toString()) / 1e18).toFixed(6);
      const allowanceFormatted = (parseFloat(allowance.toString()) / 1e18).toFixed(6);
      const isApproved = allowance > parseUnits("0.001", 18); // Has at least 0.001 WETH approved

      return {
        balance: balance.toString(),
        balanceFormatted,
        allowance: allowance.toString(),
        allowanceFormatted,
        isApproved
      };

    } catch (error) {
      console.error('❌ Error getting WETH info:', error);
      
      return {
        balance: "0",
        balanceFormatted: "0.000000",
        allowance: "0",
        allowanceFormatted: "0.000000",
        isApproved: false
      };
    }
  }

  /**
   * Generate approval transaction data (for frontend to execute)
   */
  public getApprovalTransactionData(amount: string = "1000"): {
    to: string;
    data: string;
    description: string;
  } {
    // ERC20 approve function signature: approve(address spender, uint256 amount)
    const approveSignature = "0x095ea7b3";
    const spenderAddress = this.chains.arbitrum.lopAddress.slice(2).padStart(64, '0');
    const amountHex = parseUnits(amount, 18).toString(16).padStart(64, '0');
    
    return {
      to: this.chains.arbitrum.wethAddress,
      data: approveSignature + spenderAddress + amountHex,
      description: `Approve ${amount} WETH for DCA automation`
    };
  }
}
