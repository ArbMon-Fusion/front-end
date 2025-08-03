"use client";
import {
  Address,
  CrossChainOrder,
  HashLock,
  TimeLocks,
  AuctionDetails,
  randBigInt
} from "@nikhil0341/cross-chain-sdk";
import { parseUnits, parseEther, randomBytes, Signer } from "ethers";
import { uint8ArrayToHex, UINT_40_MAX } from "@1inch/byte-utils";
import contractAddresses from "../../../deployedAddresses/addresses.json";


// Contract addresses from deployed contracts
const WETH = contractAddresses.contractAddresses.arbitrum.WETH;
const WMON = contractAddresses.contractAddresses.monad.WMON;
const srcChainId = 421614; // Arbitrum Sepolia
const dstChainId = 10143;  // Monad Testnet

export async function createCrossChainOrder(
  userAddress: string,
  swapAmount: string, // Amount in ETH (e.g., "0.01")
  swapDirection: "WETH_TO_WMON" | "WMON_TO_WETH" = "WETH_TO_WMON"
) {
  const secret = uint8ArrayToHex(randomBytes(32));
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));


  // Calculate amounts based on 1 WETH = 0.9 WMON pricing
  const makingAmount = parseUnits(swapAmount, 18);
  const takingAmount = swapDirection === "WETH_TO_WMON"
    ? parseUnits((parseFloat(swapAmount) * 0.9).toString(), 18) // 0.9 WMON per WETH
    : parseUnits((parseFloat(swapAmount) / 0.9).toString(), 18); // 1.11 WETH per WMON

  const makerAsset = swapDirection === "WETH_TO_WMON" ? WETH : WMON;
  const takerAsset = swapDirection === "WETH_TO_WMON" ? WMON : WETH;
  const srcFactory = swapDirection === "WETH_TO_WMON"
    ? contractAddresses.contractAddresses.arbitrum.factory
    : contractAddresses.contractAddresses.monad.factory;
  const resolverAddress = swapDirection === "WETH_TO_WMON"
    ? contractAddresses.contractAddresses.arbitrum.resolver
    : contractAddresses.contractAddresses.monad.resolver;

  console.log(`🔄 Creating ${swapDirection} order:`, {
    makingAmount: swapAmount,
    takingAmount: swapDirection === "WETH_TO_WMON"
      ? (parseFloat(swapAmount) * 0.9).toString()
      : (parseFloat(swapAmount) / 0.9).toString(),
    makerAsset,
    takerAsset,
    srcChain: swapDirection === "WETH_TO_WMON" ? "Arbitrum Sepolia" : "Monad Testnet",
    dstChain: swapDirection === "WETH_TO_WMON" ? "Monad Testnet" : "Arbitrum Sepolia"
  });


  //   signer!,
  //   userAddress,
  //   makerAsset,
  //   lopContract,
  //   makingAmount,
  //   swapDirection
  // );
  // Mirror exact test script order creation
  const order = CrossChainOrder.new(
    new Address(srcFactory),
    {
      salt: randBigInt(BigInt(1000)),
      maker: new Address(userAddress),
      makingAmount,
      takingAmount,
      makerAsset: new Address(makerAsset),
      takerAsset: new Address(takerAsset),
    },
    {
      hashLock: HashLock.forSingleFill(secret),
      timeLocks: TimeLocks.new({
        // Use same timelock values as test script
        srcWithdrawal: BigInt(10),
        srcPublicWithdrawal: BigInt(120),
        srcCancellation: BigInt(121),
        srcPublicCancellation: BigInt(122),
        dstWithdrawal: BigInt(10),
        dstPublicWithdrawal: BigInt(100),
        dstCancellation: BigInt(101)
      }),
      srcChainId: swapDirection === "WETH_TO_WMON" ? srcChainId : dstChainId,
      dstChainId: swapDirection === "WETH_TO_WMON" ? dstChainId : srcChainId,
      srcSafetyDeposit: parseEther('0.0001'), // Match test script
      dstSafetyDeposit: parseEther('0.0001')
    },
    {
      auction: new AuctionDetails({
        initialRateBump: 0,
        points: [],
        duration: BigInt(240), // 4 minutes like test script
        startTime: currentTimestamp
      }),
      whitelist: [
        {
          address: new Address(resolverAddress),
          allowFrom: BigInt(0)
        }
      ],
      resolvingStartTime: BigInt(0)
    },
    {
      nonce: randBigInt(UINT_40_MAX),
      allowPartialFills: false, // Match test script
      allowMultipleFills: false
    }
  );

  console.log("Line number 102 createCrossChainOrder.ts:", order);

  return {
    order,
    secret,
    orderHash: order.getOrderHash(swapDirection === "WETH_TO_WMON" ? srcChainId : dstChainId),
    swapDirection,
    makingAmount: swapAmount,
    takingAmount: swapDirection === "WETH_TO_WMON"
      ? (parseFloat(swapAmount) * 0.9).toString()
      : (parseFloat(swapAmount) / 0.9).toString()
  };
}

// Sign order function that mirrors test script's EIP-712 signing approach
export async function signCrossChainOrder(signer: Signer, order: any, chainId: number) { // eslint-disable-line @typescript-eslint/no-explicit-any
  // Mirror test script: const signature = await srcChainUser.signOrder(srcChainId, order)
  // Uses EIP-712 signing like wallet.ts line 85-93

  const typedData = order.getTypedData(chainId);
  console.log("📋 Signing order with EIP-712:", typedData);
  const signature = await signer.signTypedData(
    typedData.domain,
    { Order: typedData.types[typedData.primaryType] },
    typedData.message
  );
  console.log("✍️ Order signed successfully!", signature);

  const orderHash = order.getOrderHash(chainId);

  console.log(`📋 Order hash: ${orderHash}`);
  console.log(`✍️ Order signature (EIP-712): ${signature}`);

  return {
    orderHash,
    signature
  };
}
