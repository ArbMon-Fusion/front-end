"use client";
import { Contract, Signer, MaxUint256 } from "ethers";
import contractAddresses from "../../../deployedAddresses/addresses.json";
import ERC20ABI from "../../../Abi/IERC20.json";

export async function checkAndRequestApproval(
  signer: Signer,
  userAddress: string,
  tokenAddress: string,
  spenderAddress: string,
  requiredAmount: bigint,
  swapDirection: "WETH_TO_WMON" | "WMON_TO_WETH"
): Promise<void> {
  console.log("🔍 Checking token approval...");
  
  const tokenContract = new Contract(tokenAddress, ERC20ABI.abi, signer);
  
  // Check current allowance
  const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
  console.log(`📊 Current allowance: ${currentAllowance.toString()}`);
  console.log(`📊 Required amount: ${requiredAmount.toString()}`);
  
  if (currentAllowance < requiredAmount) {
    console.log("⚠️ Insufficient allowance, requesting approval...");
    
    const tokenSymbol = swapDirection === "WETH_TO_WMON" ? "WETH" : "WMON";
    const chainName = swapDirection === "WETH_TO_WMON" ? "Arbitrum Sepolia" : "Monad Testnet";
    
    // Request approval for unlimited amount
    const approveTx = await tokenContract.approve(spenderAddress, MaxUint256);
    console.log(`📝 Approval transaction sent: ${approveTx.hash}`);
    
    // Wait for confirmation
    const receipt = await approveTx.wait();
    console.log(`✅ ${tokenSymbol} approved to LOP on ${chainName}!`);
    
    // Verify approval
    const newAllowance = await tokenContract.allowance(userAddress, spenderAddress);
    console.log(`✅ New allowance: ${newAllowance.toString()}`);
  } else {
    console.log("✅ Sufficient allowance already exists");
  }
}

export function getLOPContract(swapDirection: "WETH_TO_WMON" | "WMON_TO_WETH"): string {
  return swapDirection === "WETH_TO_WMON" 
    ? contractAddresses.contractAddresses.arbitrum.limitOrderProtocol
    : contractAddresses.contractAddresses.monad.limitOrderProtocol;
}

export function getTokenAddress(swapDirection: "WETH_TO_WMON" | "WMON_TO_WETH"): string {
  return swapDirection === "WETH_TO_WMON"
    ? contractAddresses.contractAddresses.arbitrum.WETH
    : contractAddresses.contractAddresses.monad.WMON;
}