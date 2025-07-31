// import Sdk from "@1inch/cross-chain-sdk";
// import { parseUnits, parseEther, randomBytes } from "ethers";
// import { uint8ArrayToHex, UINT_40_MAX } from "@1inch/byte-utils";
// import { join } from "path";
// import { existsSync, writeFileSync } from "fs";

// const { Address } = Sdk;

// export async function createCrossChainOrder(params: {
//   userAddress: string;
//   srcChainId: number;
//   dstChainId: number;
//   escrowFactoryAddress: string;
//   srcTokenAddress: string;
//   dstTokenAddress: string;
//   makingAmount: string; // e.g., "100"
//   takingAmount: string; // e.g., "99"
//   tokenDecimals: number; // e.g., 6 for USDC
//   resolverAddress: string;
//   allowPartialFills?: boolean;
//   allowMultipleFills?: boolean;
// }) {
//   // Generate secret for the order
//   const secret = uint8ArrayToHex(randomBytes(32)); // Store this securely!

//   // Get current timestamp for auction start
//   const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

//   // Create the cross-chain order
//   const order = Sdk.CrossChainOrder.new(
//     new Address(params.escrowFactoryAddress),
//     {
//       salt: Sdk.randBigInt(BigInt(1000)),
//       maker: new Address(params.userAddress),
//       makingAmount: parseUnits(params.makingAmount, params.tokenDecimals),
//       takingAmount: parseUnits(params.takingAmount, params.tokenDecimals),
//       makerAsset: new Address(params.srcTokenAddress),
//       takerAsset: new Address(params.dstTokenAddress),
//     },
//     {
//       hashLock: params.allowMultipleFills
//         ? Sdk.HashLock.forMultipleFills(generateMultipleSecrets())
//         : Sdk.HashLock.forSingleFill(secret),
//       timeLocks: Sdk.TimeLocks.new({
//         srcWithdrawal: BigInt(10), // 10sec finality lock
//         srcPublicWithdrawal: BigInt(120), // 2min for private withdrawal
//         srcCancellation: BigInt(121), // 1sec public withdrawal
//         srcPublicCancellation: BigInt(122), // 1sec private cancellation
//         dstWithdrawal: BigInt(10), // 10sec finality lock
//         dstPublicWithdrawal: BigInt(100), // 100sec private withdrawal
//         dstCancellation: BigInt(101), // 1sec public withdrawal
//       }),
//       srcChainId: params.srcChainId,
//       dstChainId: params.dstChainId,
//       srcSafetyDeposit: parseEther("0.001"),
//       dstSafetyDeposit: parseEther("0.001"),
//     },
//     {
//       auction: new Sdk.AuctionDetails({
//         initialRateBump: 0,
//         points: [],
//         duration: BigInt(120),
//         startTime: currentTimestamp,
//       }),
//       whitelist: [
//         {
//           address: new Address(params.resolverAddress),
//           allowFrom: BigInt(0),
//         },
//       ],
//       resolvingStartTime: BigInt(0),
//     },
//     {
//       nonce: Sdk.randBigInt(UINT_40_MAX),
//       allowPartialFills: params.allowPartialFills || false,
//       allowMultipleFills: params.allowMultipleFills || false,
//     }
//   );

//   return {
//     order,
//     secret, // IMPORTANT: Store this securely for later withdrawal
//     orderHash: order.getOrderHash(params.srcChainId),
//   };
// }

// // Helper function for multiple fills
// function generateMultipleSecrets() {
//   const secrets = Array.from({ length: 11 }).map(() =>
//     uint8ArrayToHex(randomBytes(32))
//   );
//   const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s));
//   return Sdk.HashLock.getMerkleLeaves(secrets);
// }

// // Example usage function
// export async function handleOrderCreation(userWallet: any) {
//   const orderData = await createCrossChainOrder({
//     userAddress: await userWallet.getAddress(),
//     srcChainId: 1, // Ethereum
//     dstChainId: 56, // BSC
//     escrowFactoryAddress: "0x...", // Your deployed factory address
//     srcTokenAddress: "0xA0b86a33E6441E6C8C7C7B0b2C4C6C6C6C6C6C6C", // USDC on Ethereum
//     dstTokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC on BSC
//     makingAmount: "100",
//     takingAmount: "99",
//     tokenDecimals: 6,
//     resolverAddress: "0x...", // Authorized resolver address
//     allowPartialFills: false,
//     allowMultipleFills: false,
//   });

//   // Sign the order
//   const signature = await userWallet.signOrder(
//     orderData.order.srcChainId,
//     orderData.order
//   );

//   // Store the order details
//   const orderRecord = {
//     userAddress: await userWallet.getAddress(),
//     signature,
//     orderHash: orderData.orderHash,
//   };

//   const utilsDir = join(__dirname, 'utils');
//   const filePath = join(utilsDir, 'orderRecords.json');

//   if (!existsSync(utilsDir)) {
//     require('fs').mkdirSync(utilsDir);
//   }

//   let records = [];
//   if (existsSync(filePath)) {
//     const data = require('fs').readFileSync(filePath);
//     records = JSON.parse(data);
//   }

//   records.push(orderRecord);
//   writeFileSync(filePath, JSON.stringify(records, null, 2));

//   console.log('Order details stored in utils/orderRecords.json:', orderRecord);

//   return {
//     order: orderData.order,
//     signature,
//     secret: orderData.secret,
//     orderHash: orderData.orderHash,
//   };
// }
