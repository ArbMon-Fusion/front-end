"use client";
import { Contract, parseUnits, MaxUint256 } from "ethers";
import { Signer } from "ethers";
import contractAddresses from "../../../deployedAddresses/addresses.json";
import IERC20ABI from "../../../Abi/IERC20.json";

// Contract addresses
const WETH = contractAddresses.contractAddresses.arbitrum.WETH;
const WMON = contractAddresses.contractAddresses.monad.WMON;
// const ARBITRUM_FACTORY = contractAddresses.contractAddresses.arbitrum.factory;
// const MONAD_FACTORY = contractAddresses.contractAddresses.monad.factory;

export interface ApprovalStatus {
  isApproved: boolean;
  currentAllowance: bigint;
  requiredAmount: bigint;
  tokenAddress: string;
  spenderAddress: string;
}

export async function checkApproval(
  signer: Signer,
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): Promise<ApprovalStatus> {
  const tokenContract = new Contract(tokenAddress, IERC20ABI.abi, signer);
  console.log("Signer address:", await signer.getAddress());
  const network = await signer.provider?.getNetwork();
  console.log("Network:", network?.name, "Chain ID:", network?.chainId);
  const userAddress = await signer.getAddress();
  console.log("User address:", userAddress);
  console.log("Token address:", tokenAddress);
  console.log("Spender address:", spenderAddress);
  console.log("Amount to check:", amount);

  console.log("Checking approval for", tokenAddress, spenderAddress, amount);
  
  const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
  console.log("Current allowance:", currentAllowance.toString());
  const requiredAmount = parseUnits(amount, 18);
  
  return {
    isApproved: currentAllowance >= requiredAmount,
    currentAllowance,
    requiredAmount,
    tokenAddress,
    spenderAddress
  };
}

export async function approveToken(
  signer: Signer,
  tokenAddress: string,
  spenderAddress: string,
  amount: string = "unlimited"
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const tokenContract = new Contract(tokenAddress, IERC20ABI.abi, signer);
    
    // Check current allowance first
    const userAddress = await signer.getAddress();
    const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
    const requiredAmount = amount === "unlimited" ? MaxUint256 : parseUnits(amount, 18);
    
    // If already approved, return success
    if (currentAllowance >= requiredAmount) {
      return { success: true };
    }
    
    console.log(`🔐 Approving ${tokenAddress} for ${spenderAddress}`);
    console.log(`💰 Amount: ${amount === "unlimited" ? "unlimited" : amount}`);
    
    const tx = await tokenContract.approve(spenderAddress, requiredAmount);
    const receipt = await tx.wait();
    
    console.log(`✅ Approval successful! Tx: ${receipt?.hash}`);
    
    return { 
      success: true, 
      txHash: receipt?.hash 
    };
    
  } catch (error) {
    console.error("❌ Approval failed:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export function getTokenAndSpenderForDirection(
  swapDirection: "WETH_TO_WMON" | "WMON_TO_WETH"
): { tokenAddress: string; spenderAddress: string } {
  // console.log("Determining token and spender for direction:", swapDirection);
  if (swapDirection === "WETH_TO_WMON") {
    return {
      tokenAddress: WETH,
      spenderAddress: contractAddresses.contractAddresses.arbitrum.limitOrderProtocol
    };
  } else {
    // For WMON_TO_WETH, we need WMON token and Monad limit order protocol
    return {
      tokenAddress: WMON,
      spenderAddress: contractAddresses.contractAddresses.monad.limitOrderProtocol
    };
  }
}