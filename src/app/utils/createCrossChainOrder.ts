// import Sdk from "@1inch/cross-chain-sdk";
// import { parseUnits, parseEther, randomBytes, Signer } from "ethers";
// import { uint8ArrayToHex, UINT_40_MAX } from "@1inch/byte-utils";
// import { join } from "path";
// import { existsSync, writeFileSync, mkdirSync, readFileSync } from "fs";

// const { Address } = Sdk;

// export async function createCrossChainOrder(params: {
//   userAddress: string;
//   srcChainId: number;
//   dstChainId: number;
//   escrowFactoryAddress: string;
//   srcTokenAddress: string;
//   dstTokenAddress: string;
//   makingAmount: string;
//   takingAmount: string;
//   tokenDecimals: number;
//   resolverAddress: string;
//   allowPartialFills?: boolean;
//   allowMultipleFills?: boolean;
// }) {
//   const secret = uint8ArrayToHex(randomBytes(32));
//   const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

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
//         srcWithdrawal: BigInt(10),
//         srcPublicWithdrawal: BigInt(120),
//         srcCancellation: BigInt(121),
//         srcPublicCancellation: BigInt(122),
//         dstWithdrawal: BigInt(10),
//         dstPublicWithdrawal: BigInt(100),
//         dstCancellation: BigInt(101),
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
//     secret,
//     orderHash: order.getOrderHash(params.srcChainId),
//   };
// }

// function generateMultipleSecrets() {
//   const secrets = Array.from({ length: 11 }).map(() =>
//     uint8ArrayToHex(randomBytes(32))
//   );
//   return Sdk.HashLock.getMerkleLeaves(secrets);
// }

// export async function handleOrderCreation(
//   signer: Signer,
//   userAddress: string
//   //need more params for order creation from frontend
// ) {
//   const orderData = await createCrossChainOrder({
//     userAddress,
//     srcChainId: 1,
//     dstChainId: 56,
//     escrowFactoryAddress: "0x...", // Replace
//     srcTokenAddress: "0xA0b86a33E6441E6C8C7C7B0b2C4C6C6C6C6C6C6C", // Replace
//     dstTokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
//     makingAmount: "100",
//     takingAmount: "99",
//     tokenDecimals: 6,
//     resolverAddress: "0x...", // Replace
//     allowPartialFills: false,
//     allowMultipleFills: false,
//   });

//   const orderHash = orderData.order.getOrderHash(orderData.order.srcChainId);
//   const signature = await signer.signMessage(orderHash);

//   const orderRecord = {
//     userAddress,
//     signature,
//     orderData: orderData.order.toJSON(),
//     orderHash: orderData.orderHash,
//   };

//   const utilsDir = join(__dirname, "utils");
//   const filePath = join(utilsDir, "orderRecords.json");

//   if (!existsSync(utilsDir)) mkdirSync(utilsDir);

//   let records = [];
//   if (existsSync(filePath)) {
//     const data = readFileSync(filePath);
//     records = JSON.parse(data.toString());
//   }

//   records.push(orderRecord);
//   writeFileSync(filePath, JSON.stringify(records, null, 2));

//   console.log("Order details stored in utils/orderRecords.json:", orderRecord);

//   return {
//     order: orderData.order,
//     signature,
//     secret: orderData.secret,
//     orderHash: orderData.orderHash,
//   };
// }
