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
  AmountMode,
  Immutables,
  DstImmutablesComplement,
  HashLock,
  TimeLocks,
  EscrowFactory
} from "@nikhil0341/cross-chain-sdk";
import contractAddresses from "../../../deployedAddresses/addresses.json";
import ResolverABI from "../../../Abi/Resolver.json";
import EscrowFactoryABI from "../../../Abi/EscrowFactory.json";

const DEPLOYER_PRIVATE_KEY = process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY!;

// Chain configurations
const chains = {
  arbitrum: {
    rpc: process.env.NEXT_PUBLIC_ARB_RPC_URL!,
    chainId: 421614
  },
  monad: {
    rpc: process.env.NEXT_PUBLIC_MONAD_RPC_URL!,
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

    // Dynamic chain selection based on swap direction
    const isWethToWmon = orderData.swapDirection === "WETH_TO_WMON";
    const srcChain = isWethToWmon ? chains.arbitrum : chains.monad;
    const dstChain = isWethToWmon ? chains.monad : chains.arbitrum;
    const srcContracts = isWethToWmon ? contractAddresses.contractAddresses.arbitrum : contractAddresses.contractAddresses.monad;
    const dstContracts = isWethToWmon ? contractAddresses.contractAddresses.monad : contractAddresses.contractAddresses.arbitrum;

    console.log(`📍 Source chain: ${isWethToWmon ? 'Arbitrum Sepolia' : 'Monad Testnet'}`);
    console.log(`📍 Destination chain: ${isWethToWmon ? 'Monad Testnet' : 'Arbitrum Sepolia'}`);

    // Initialize providers and wallets (mirrors test script setup)
    const srcProvider = new JsonRpcProvider(srcChain.rpc, srcChain.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });

    const srcChainResolver = new Wallet(DEPLOYER_PRIVATE_KEY, srcProvider);

    // Create resolver contract instance (mirrors test script line 259)
    const resolverContract = new ResolverOperations(
      srcContracts.resolver,
      dstContracts.resolver
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
      srcContracts.factory,
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

// Phase 3 main function - mirrors test script destination escrow deployment
export async function executePhase3() {
  try {
    console.log("🚀 Starting Phase 3: Destination escrow deployment");

    // Get Phase 2 data
    const phase2Data = (window as any).phase2Data;
    const orderData = (window as any).orderData;

    console.log("📋 Phase 2 data before start phase 3:", phase2Data);
    console.log("📋 order data before start phase 3:", orderData);
    if (!phase2Data || !orderData) {
      throw new Error("Please complete Phase 1 and Phase 2 first");
    }

    // Dynamic chain selection based on swap direction
    const isWethToWmon = orderData.swapDirection === "WETH_TO_WMON";
    const dstChain = isWethToWmon ? chains.monad : chains.arbitrum;
    const srcContracts = isWethToWmon ? contractAddresses.contractAddresses.arbitrum : contractAddresses.contractAddresses.monad;
    const dstContracts = isWethToWmon ? contractAddresses.contractAddresses.monad : contractAddresses.contractAddresses.arbitrum;

    console.log(`📍 Destination chain: ${isWethToWmon ? 'Monad Testnet' : 'Arbitrum Sepolia'}`);

    // Initialize destination provider and wallet
    const dstProvider = new JsonRpcProvider(dstChain.rpc, dstChain.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });

    const dstChainResolver = new Wallet(DEPLOYER_PRIVATE_KEY!, dstProvider);

    // Create resolver contract instance
    const resolverContract = new ResolverOperations(
      srcContracts.resolver,
      dstContracts.resolver
    );

    // Create destination immutables (mirrors test script lines 279-281)
    console.log("📝 Creating destination immutables...");
    const srcEscrowEventData = phase2Data.srcEscrowEvent;
    console.log("📋 Source escrow event data:", srcEscrowEventData);

    // Reconstruct SDK objects from raw event data (mirrors escrow-factory.ts lines 63-79)
    const rawImmutables = srcEscrowEventData[0]; // srcImmutables from event
    const rawComplement = srcEscrowEventData[1]; // dstImmutablesComplement from event

    console.log("📋 Raw immutables:", rawImmutables);
    console.log("📋 Raw complement:", rawComplement);

    // Create SDK Immutables object (mirrors escrow-factory.ts lines 63-72)
    const immutables = Immutables.new({
      orderHash: rawImmutables[0],
      hashLock: HashLock.fromString(rawImmutables[1]),
      maker: Address.fromBigInt(rawImmutables[2]),
      taker: Address.fromBigInt(rawImmutables[3]),
      token: Address.fromBigInt(rawImmutables[4]),
      amount: rawImmutables[5],
      safetyDeposit: rawImmutables[6],
      timeLocks: TimeLocks.fromBigInt(rawImmutables[7])
    });

    // Create SDK DstImmutablesComplement object (mirrors escrow-factory.ts lines 73-79)
    const complement = DstImmutablesComplement.new({
      maker: Address.fromBigInt(rawComplement[0]),
      amount: rawComplement[1],
      token: Address.fromBigInt(rawComplement[2]),
      safetyDeposit: rawComplement[3]
    });

    // Create destination immutables (mirrors test script lines 279-281)
    const dstImmutables = immutables
      .withComplement(complement)
      .withTaker(new Address(resolverContract.dstResolverAddress));

    console.log("📋 Destination immutables created:", dstImmutables);

    // Check resolver balance and allowance (mirrors test script lines 286-297)
    const dstTokenAddress = isWethToWmon
      ? contractAddresses.contractAddresses.monad.WMON
      : contractAddresses.contractAddresses.arbitrum.WETH;
    const dstTokenSymbol = isWethToWmon ? "WMON" : "WETH";
    const dstChainName = isWethToWmon ? "Monad" : "Arbitrum";

    console.log(`💰 Checking resolver ${dstTokenSymbol} balance and allowance...`);

    const dstTokenContract = new Contract(
      dstTokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
      dstProvider
    );

    const resolverAddress = await dstChainResolver.getAddress();
    const resolverTokenBalance = await dstTokenContract.balanceOf(resolverAddress);
    const resolverAllowance = await dstTokenContract.allowance(
      resolverAddress,
      dstContracts.factory
    );

    console.log(`💰 Resolver ${dstTokenSymbol} balance: ${resolverTokenBalance.toString()}`);
    console.log(`🔓 Resolver ${dstTokenSymbol} allowance to factory: ${resolverAllowance.toString()}`);
    console.log(`💸 Required ${dstTokenSymbol} amount: ${orderData.order.takingAmount.toString()}`);
    console.log(`💸 Required ${dstChainName} safety deposit: 0.0001 ETH`);

    // Deploy destination escrow (mirrors test script lines 299-301)
    console.log(`📝 Deploying destination escrow on ${dstChainName}...`);

    const deployDstTx = resolverContract.deployDst(dstImmutables);

    const response = await dstChainResolver.sendTransaction({
      ...deployDstTx,
      gasLimit: 10_000_000
    });

    const receipt = await response.wait(1);
    const blockTimestamp = BigInt((await receipt?.getBlock())?.timestamp || 0);

    console.log(`✅ Destination escrow created on ${dstChainName}: ${receipt?.hash}`);

    // Store data for Phase 4
    (window as any).phase3Data = {
      dstImmutables: dstImmutables.withDeployedAt(blockTimestamp),
      dstDepositHash: receipt?.hash,
      blockTimestamp,
      resolverContract,
      dstChainResolver: dstChainResolver.address
    };

    console.log("✅ Phase 3 Complete!");
    console.log("📊 Results:", {
      txHash: receipt?.hash,
      blockTimestamp: blockTimestamp.toString(),
      gasUsed: receipt?.gasUsed?.toString()
    });

    return {
      success: true,
      txHash: receipt?.hash,
      blockTimestamp,
      dstImmutables
    };

  } catch (error) {
    console.error("❌ Phase 3 failed:", error);
    throw error;
  }
}

// Phase 4 main function - mirrors test script withdrawals
export async function executePhase4() {
  try {
    console.log("🚀 Starting Phase 4: Complete withdrawals");

    // Get all previous phase data
    const phase2Data = (window as any).phase2Data;
    const phase3Data = (window as any).phase3Data;
    const orderData = (window as any).orderData;

    if (!phase2Data || !phase3Data || !orderData) {
      throw new Error("Please complete all previous phases first");
    }

    console.log("📋 Phase 2 data:", phase2Data);
    console.log("📋 Phase 3 data:", phase3Data);
    console.log("📋 Order data:", orderData);

    // Dynamic chain selection based on swap direction
    const isWethToWmon = orderData.swapDirection === "WETH_TO_WMON";
    const srcChain = isWethToWmon ? chains.arbitrum : chains.monad;
    const dstChain = isWethToWmon ? chains.monad : chains.arbitrum;
    const srcContracts = isWethToWmon ? contractAddresses.contractAddresses.arbitrum : contractAddresses.contractAddresses.monad;
    const dstContracts = isWethToWmon ? contractAddresses.contractAddresses.monad : contractAddresses.contractAddresses.arbitrum;

    console.log(`📍 Source chain: ${isWethToWmon ? 'Arbitrum Sepolia' : 'Monad Testnet'}`);
    console.log(`📍 Destination chain: ${isWethToWmon ? 'Monad Testnet' : 'Arbitrum Sepolia'}`);

    // Initialize providers and wallets for both chains
    const srcProvider = new JsonRpcProvider(srcChain.rpc, srcChain.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });

    const dstProvider = new JsonRpcProvider(dstChain.rpc, dstChain.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });

    const srcChainResolver = new Wallet(DEPLOYER_PRIVATE_KEY!, srcProvider);
    const dstChainResolver = new Wallet(DEPLOYER_PRIVATE_KEY!, dstProvider);

    // Create resolver contract instance
    const resolverContract = new ResolverOperations(
      srcContracts.resolver,
      dstContracts.resolver
    );

    // Reconstruct immutables from Phase 2 data (same as Phase 3)
    const srcEscrowEventData = phase2Data.srcEscrowEvent;
    const rawImmutables = srcEscrowEventData[0];
    const rawComplement = srcEscrowEventData[1];

    const srcImmutables = Immutables.new({
      orderHash: rawImmutables[0],
      hashLock: HashLock.fromString(rawImmutables[1]),
      maker: Address.fromBigInt(rawImmutables[2]),
      taker: Address.fromBigInt(rawImmutables[3]),
      token: Address.fromBigInt(rawImmutables[4]),
      amount: rawImmutables[5],
      safetyDeposit: rawImmutables[6],
      timeLocks: TimeLocks.fromBigInt(rawImmutables[7])
    });

    // Wait for finality period (mirrors test script line 305-306)
    console.log('⏰ Waiting for finality period (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Calculate escrow addresses (mirrors test script lines 309-320)
    console.log("📍 Calculating escrow addresses...");

    const srcEscrowFactory = new EscrowFactory(new Address(contractAddresses.contractAddresses.arbitrum.factory));
    const dstEscrowFactory = new EscrowFactory(new Address(contractAddresses.contractAddresses.monad.factory));

    const srcEscrowAddress = srcEscrowFactory.getSrcEscrowAddress(
      srcImmutables,
      new Address(contractAddresses.contractAddresses.arbitrum.escrowSrcImpl)
    );

    const dstEscrowAddress = dstEscrowFactory.getDstEscrowAddress(
      srcImmutables,
      DstImmutablesComplement.new({
        maker: Address.fromBigInt(rawComplement[0]),
        amount: rawComplement[1],
        token: Address.fromBigInt(rawComplement[2]),
        safetyDeposit: rawComplement[3]
      }),
      phase3Data.blockTimestamp,
      new Address(resolverContract.dstResolverAddress),
      new Address(dstContracts.escrowDstImpl)
    );

    const srcTokenSymbol = isWethToWmon ? "WETH" : "WMON";
    const dstTokenSymbol = isWethToWmon ? "WMON" : "WETH";
    const srcChainName = isWethToWmon ? "Arbitrum" : "Monad";
    const dstChainName = isWethToWmon ? "Monad" : "Arbitrum";

    console.log(`📍 Source escrow address: ${srcEscrowAddress}`);
    console.log(`📍 Destination escrow address: ${dstEscrowAddress}`);

    // User withdraws tokens from destination chain (mirrors test script lines 322-327)
    console.log(`💸 User withdrawing ${dstTokenSymbol} from ${dstChainName} escrow: ${dstEscrowAddress}`);

    const userWithdrawTx = resolverContract.withdraw(
      'dst',
      dstEscrowAddress.toString(),
      orderData.secret,
      phase3Data.dstImmutables
    );

    const userWithdrawResponse = await dstChainResolver.sendTransaction({
      ...userWithdrawTx,
      gasLimit: 10_000_000
    });

    const userWithdrawReceipt = await userWithdrawResponse.wait(1);
    console.log(`✅ User withdrew ${dstTokenSymbol}: ${userWithdrawReceipt?.hash}`);

    // Resolver withdraws tokens from source chain (mirrors test script lines 329-334)
    console.log(`💸 Resolver withdrawing ${srcTokenSymbol} from ${srcChainName} escrow: ${srcEscrowAddress}`);

    const resolverWithdrawTx = resolverContract.withdraw(
      'src',
      srcEscrowAddress.toString(),
      orderData.secret,
      srcImmutables
    );

    const resolverWithdrawResponse = await srcChainResolver.sendTransaction({
      ...resolverWithdrawTx,
      gasLimit: 10_000_000
    });

    const resolverWithdrawReceipt = await resolverWithdrawResponse.wait(1);
    console.log(`✅ Resolver withdrew ${srcTokenSymbol}: ${resolverWithdrawReceipt?.hash}`);


    console.log("💰 Checking final token balances...");

    const wethProvider = new JsonRpcProvider(chains.arbitrum.rpc, chains.arbitrum.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });

    const wethContract = new Contract(
      contractAddresses.contractAddresses.arbitrum.WETH,
      ['function balanceOf(address) view returns (uint256)'],
      wethProvider
    );

    const wmonProvider = new JsonRpcProvider(chains.monad.rpc, chains.monad.chainId, {
      cacheTimeout: -1,
      staticNetwork: true
    });
    
    const wmonContract = new Contract(
      contractAddresses.contractAddresses.monad.WMON,
      ['function balanceOf(address) view returns (uint256)'],
      wmonProvider
    );

    // Get user address from order data
    const userAddress = orderData.order.maker.toString();
    const resolverAddress = await srcChainResolver.getAddress();

    const finalUserWethBalance = await wethContract.balanceOf(userAddress);
    const finalUserWmonBalance = await wmonContract.balanceOf(userAddress);
    const finalResolverWethBalance = await wethContract.balanceOf(resolverAddress);

    console.log("✅ Phase 4 Complete!");
    console.log("📊 Final Results:", {
      userWithdrawTx: userWithdrawReceipt?.hash,
      resolverWithdrawTx: resolverWithdrawReceipt?.hash,
      userWethBalance: finalUserWethBalance.toString(),
      userWmonBalance: finalUserWmonBalance.toString(),
      resolverWethBalance: finalResolverWethBalance.toString(),
      srcEscrowAddress: srcEscrowAddress.toString(),
      dstEscrowAddress: dstEscrowAddress.toString()
    });

    return {
      success: true,
      userWithdrawTx: userWithdrawReceipt?.hash,
      resolverWithdrawTx: resolverWithdrawReceipt?.hash,
      finalBalances: {
        userWeth: finalUserWethBalance.toString(),
        userWmon: finalUserWmonBalance.toString(),
        resolverWeth: finalResolverWethBalance.toString()
      }
    };

  } catch (error) {
    console.error("❌ Phase 4 failed:", error);
    throw error;
  }
}
