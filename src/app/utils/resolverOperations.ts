"use client";
import { 
  JsonRpcProvider, 
  Wallet, 
  Interface, 
  Signature,
  TransactionRequest,
  Contract
} from "ethers";
import { 
  Address, 
  TakerTraits, 
  AmountMode
} from "@1inch/cross-chain-sdk";
import contractAddresses from "../../../deployedAddresses/addresses.json";
import ResolverABI from "../../../Abi/Resolver.json";
import EscrowFactoryABI from "../../../Abi/EscrowFactory.json";

const DEPLOYER_PRIVATE_KEY = process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY!;

// Chain configurations
const chains = {
  arbitrum: {
    rpc: "https://arb-sepolia.g.alchemy.com/v2/TRxeW47imEqxxdPubmvTuhcG334Udxb0",
    chainId: 421614
  },
  monad: {
    rpc: "https://monad-testnet.g.alchemy.com/v2/TRxeW47imEqxxdPubmvTuhcG334Udxb0", 
    chainId: 10143
  }
};

export class ResolverOperations {
  private resolverInterface: Interface;
  
  constructor(
    public readonly srcResolverAddress: string,
    public readonly dstResolverAddress: string
  ) {
    this.resolverInterface = new Interface(ResolverABI.abi);
  }

  // Phase 2: Deploy source escrow (mirrors test script lines 262-273)
  public deploySrc(
    chainId: number,
    order: any,
    signature: string,
    takerTraits: any,
    amount: bigint,
    hashLock?: any
  ): TransactionRequest {
    const { r, yParityAndS: vs } = Signature.from(signature);
    const { args, trait } = takerTraits.encode();
    const immutables = order.toSrcImmutables(
      chainId, 
      new Address(this.srcResolverAddress), 
      amount, 
      hashLock || order.escrowExtension.hashLockInfo
    );

    console.log("🔄 Deploying source escrow...");
    console.log("📍 Src Resolver:", this.srcResolverAddress);
    console.log("📍 Dst Resolver:", this.dstResolverAddress);
    console.log("💰 Amount:", amount.toString());

    return {
      to: this.srcResolverAddress,
      data: this.resolverInterface.encodeFunctionData('deploySrc', [
        immutables.build(),
        order.build(),
        r,
        vs,
        amount,
        trait,
        args
      ]),
      value: order.escrowExtension.srcSafetyDeposit
    };
  }

  // Phase 3: Deploy destination escrow
  public deployDst(immutables: any): TransactionRequest {
    console.log("🔄 Deploying destination escrow...");
    
    return {
      to: this.dstResolverAddress,
      data: this.resolverInterface.encodeFunctionData('deployDst', [
        immutables.build(),
        immutables.timeLocks.toSrcTimeLocks().privateCancellation
      ]),
      value: immutables.safetyDeposit
    };
  }

  // Phase 4: Withdraw functions
  public withdraw(
    side: 'src' | 'dst',
    escrowAddress: string,
    secret: string,
    immutables: any
  ): TransactionRequest {
    const resolverAddress = side === 'src' ? this.srcResolverAddress : this.dstResolverAddress;
    
    return {
      to: resolverAddress,
      data: this.resolverInterface.encodeFunctionData('withdraw', [
        escrowAddress,
        secret,
        immutables.build()
      ])
    };
  }
}

// Phase 2 main function - mirrors test script resolver fill
export async function executePhase2(orderData: any) {
  try {
    console.log("🚀 Starting Phase 2: Source chain order fill and escrow deployment");
    
    // Initialize providers and wallets (mirrors test script setup)
    const srcProvider = new JsonRpcProvider(chains.arbitrum.rpc, chains.arbitrum.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });
    
    const srcChainResolver = new Wallet(DEPLOYER_PRIVATE_KEY, srcProvider);
    
    // Create resolver contract instance (mirrors test script line 259)
    const resolverContract = new ResolverOperations(
      contractAddresses.contractAddresses.arbitrum.resolver,
      contractAddresses.contractAddresses.monad.resolver
    );

    // Create TakerTraits (mirrors test script lines 267-270)
    const takerTraits = TakerTraits.default()
      .setExtension(orderData.order.extension)
      .setAmountMode(AmountMode.maker)
      .setAmountThreshold(orderData.order.takingAmount);

    // Get swap amount from order
    const swapAmount = orderData.order.makingAmount;

    // Deploy source escrow (mirrors test script lines 262-273)
    const deployTx = resolverContract.deploySrc(
      orderData.chainId,
      orderData.order,
      orderData.signature,
      takerTraits,
      swapAmount
    );

    console.log("📝 Sending deploySrc transaction...");
    const response = await srcChainResolver.sendTransaction({
      ...deployTx,
      gasLimit: 10_000_000
    });
    
    const receipt = await response.wait(1);
    console.log(`✅ Source escrow deployed! Tx: ${receipt?.hash}`);

    // Get source escrow deployment event (mirrors test script line 278)
    const srcFactory = new Contract(
      contractAddresses.contractAddresses.arbitrum.factory,
      EscrowFactoryABI.abi,
      srcProvider
    );

    // Find the SrcEscrowCreated event
    const events = await srcFactory.queryFilter(
      srcFactory.filters.SrcEscrowCreated(),
      receipt?.blockNumber,
      receipt?.blockNumber
    );

    if (events.length === 0) {
      throw new Error("SrcEscrowCreated event not found");
    }

    const srcEscrowEvent = events[0] as any;
    console.log("📋 Source escrow event found:", srcEscrowEvent.args);

    // Store data for Phase 3
    (window as any).phase2Data = {
      srcEscrowEvent: srcEscrowEvent.args,
      blockHash: receipt?.blockHash,
      resolverContract,
      srcChainResolver: srcChainResolver.address
    };

    console.log("✅ Phase 2 Complete!");
    console.log("📊 Results:", {
      txHash: receipt?.hash,
      blockHash: receipt?.blockHash,
      srcEscrowAddress: srcEscrowEvent.args?.[0], // First arg is usually escrow address
      gasUsed: receipt?.gasUsed?.toString()
    });

    return {
      success: true,
      txHash: receipt?.hash,
      blockHash: receipt?.blockHash,
      srcEscrowEvent: srcEscrowEvent.args
    };

  } catch (error) {
    console.error("❌ Phase 2 failed:", error);
    throw error;
  }
}
