// import { Interface, Signature, TransactionRequest, JsonRpcProvider } from 'ethers'  
// import Sdk from '@1inch/cross-chain-sdk'  
// import { parseUnits, parseEther, randomBytes } from 'ethers'  
// import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils'  
// import Contract from '../dist/contracts/Resolver.sol/Resolver.json'  
  
// // Resolver Service Class  
// export class ResolverService {  
//     private readonly iface = new Interface(Contract.abi)  
//     private srcChainResolver: any  
//     private dstChainResolver: any  
//     private srcFactory: any  
//     private dstFactory: any  
  
//     constructor(  
//         public readonly srcAddress: string,  
//         public readonly dstAddress: string,  
//         srcChainResolver: any,  
//         dstChainResolver: any,  
//         srcFactory: any,  
//         dstFactory: any  
//     ) {  
//         this.srcChainResolver = srcChainResolver  
//         this.dstChainResolver = dstChainResolver  
//         this.srcFactory = srcFactory  
//         this.dstFactory = dstFactory  
//     }  
  
//     // Deploy source escrow and fill order  
//     public async deploySrc(  
//         chainId: number,  
//         order: Sdk.CrossChainOrder,  
//         signature: string,  
//         takerTraits: Sdk.TakerTraits,  
//         amount: bigint,  
//         hashLock = order.escrowExtension.hashLockInfo  
//     ): Promise<{txHash: string; blockHash: string; blockTimestamp: bigint}> {  
//         const {r, yParityAndS: vs} = Signature.from(signature)  
//         const {args, trait} = takerTraits.encode()  
//         const immutables = order.toSrcImmutables(chainId, new Sdk.Address(this.srcAddress), amount, hashLock)  
  
//         const txRequest: TransactionRequest = {  
//             to: this.srcAddress,  
//             data: this.iface.encodeFunctionData('deploySrc', [  
//                 immutables.build(),  
//                 order.build(),  
//                 r,  
//                 vs,  
//                 amount,  
//                 trait,  
//                 args  
//             ]),  
//             value: order.escrowExtension.srcSafetyDeposit  
//         }  
  
//         console.log(`[${chainId}] Deploying source escrow and filling order`)  
//         return await this.srcChainResolver.send(txRequest)  
//     }  
  
//     // Deploy destination escrow  
//     public async deployDst(  
//         immutables: Sdk.Immutables  
//     ): Promise<{txHash: string; blockHash: string; blockTimestamp: bigint}> {  
//         const txRequest: TransactionRequest = {  
//             to: this.dstAddress,  
//             data: this.iface.encodeFunctionData('deployDst', [  
//                 immutables.build(),  
//                 immutables.timeLocks.toSrcTimeLocks().privateCancellation  
//             ]),  
//             value: immutables.safetyDeposit  
//         }  
  
//         console.log(`Deploying destination escrow`)  
//         return await this.dstChainResolver.send(txRequest)  
//     }  
  
//     // Withdraw funds from escrow  
//     public async withdraw(  
//         side: 'src' | 'dst',  
//         escrow: Sdk.Address,  
//         secret: string,  
//         immutables: Sdk.Immutables  
//     ): Promise<{txHash: string; blockHash: string; blockTimestamp: bigint}> {  
//         const txRequest: TransactionRequest = {  
//             to: side === 'src' ? this.srcAddress : this.dstAddress,  
//             data: this.iface.encodeFunctionData('withdraw', [escrow.toString(), secret, immutables.build()])  
//         }  
  
//         const resolver = side === 'src' ? this.srcChainResolver : this.dstChainResolver  
//         console.log(`Withdrawing funds from ${side} escrow ${escrow.toString()}`)  
//         return await resolver.send(txRequest)  
//     }  
  
//     // Cancel escrow  
//     public async cancel(  
//         side: 'src' | 'dst',   
//         escrow: Sdk.Address,   
//         immutables: Sdk.Immutables  
//     ): Promise<{txHash: string; blockHash: string; blockTimestamp: bigint}> {  
//         const txRequest: TransactionRequest = {  
//             to: side === 'src' ? this.srcAddress : this.dstAddress,  
//             data: this.iface.encodeFunctionData('cancel', [escrow.toString(), immutables.build()])  
//         }  
  
//         const resolver = side === 'src' ? this.srcChainResolver : this.dstChainResolver  
//         console.log(`Cancelling ${side} escrow ${escrow.toString()}`)  
//         return await resolver.send(txRequest)  
//     }  
  
//     // Complete cross-chain swap simulation  
//     public async simulateCompleteSwap(  
//         srcChainId: number,  
//         dstChainId: number,  
//         order: Sdk.CrossChainOrder,  
//         signature: string,  
//         secret: string,  
//         fillAmount: bigint  
//     ): Promise<void> {  
//         try {  
//             console.log(`Starting cross-chain swap simulation`)  
//             console.log(`Order hash: ${order.getOrderHash(srcChainId)}`)  
  
//             // Step 1: Deploy source escrow and fill order  
//             const {blockHash: srcDeployBlock} = await this.deploySrc(  
//                 srcChainId,  
//                 order,  
//                 signature,  
//                 Sdk.TakerTraits.default()  
//                     .setExtension(order.extension)  
//                     .setAmountMode(Sdk.AmountMode.maker)  
//                     .setAmountThreshold(order.takingAmount),  
//                 fillAmount  
//             )  
  
//             // Step 2: Get source escrow event and prepare destination immutables  
//             const srcEscrowEvent = await this.srcFactory.getSrcDeployEvent(srcDeployBlock)  
//             const dstImmutables = srcEscrowEvent[0]  
//                 .withComplement(srcEscrowEvent[1])  
//                 .withTaker(new Sdk.Address(this.dstAddress))  
  
//             // Step 3: Deploy destination escrow  
//             const {blockTimestamp: dstDeployedAt} = await this.deployDst(dstImmutables)  
  
//             // Step 4: Calculate escrow addresses  
//             const ESCROW_SRC_IMPLEMENTATION = await this.srcFactory.getSourceImpl()  
//             const ESCROW_DST_IMPLEMENTATION = await this.dstFactory.getDestinationImpl()  
  
//             const srcEscrowAddress = new Sdk.EscrowFactory(new Sdk.Address(this.srcAddress)).getSrcEscrowAddress(  
//                 srcEscrowEvent[0],  
//                 ESCROW_SRC_IMPLEMENTATION  
//             )  
  
//             const dstEscrowAddress = new Sdk.EscrowFactory(new Sdk.Address(this.dstAddress)).getDstEscrowAddress(  
//                 srcEscrowEvent[0],  
//                 srcEscrowEvent[1],  
//                 dstDeployedAt,  
//                 new Sdk.Address(this.dstAddress),  
//                 ESCROW_DST_IMPLEMENTATION  
//             )  
  
//             // Step 5: Wait for finality lock (simulate time passage)  
//             console.log(`Waiting for finality lock period...`)  
//             await this.increaseTime(11)  
  
//             // Step 6: Withdraw from destination (reveals secret to user)  
//             await this.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))  
  
//             // Step 7: Withdraw from source (completes atomic swap)  
//             await this.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])  
  
//             console.log(`Cross-chain swap completed successfully!`)  
  
//         } catch (error) {  
//             console.error(`Cross-chain swap failed:`, error)  
//             throw error  
//         }  
//     }  
  
//     // Simulate cancellation scenario  
//     public async simulateCancellation(  
//         srcChainId: number,  
//         dstChainId: number,  
//         order: Sdk.CrossChainOrder,  
//         signature: string,  
//         fillAmount: bigint  
//     ): Promise<void> {  
//         try {  
//             console.log(`Starting cancellation simulation`)  
  
//             // Deploy both escrows but don't reveal secret  
//             const {blockHash: srcDeployBlock} = await this.deploySrc(  
//                 srcChainId,  
//                 order,  
//                 signature,  
//                 Sdk.TakerTraits.default()  
//                     .setExtension(order.extension)  
//                     .setAmountMode(Sdk.AmountMode.maker)  
//                     .setAmountThreshold(order.takingAmount),  
//                 fillAmount  
//             )  
  
//             const srcEscrowEvent = await this.srcFactory.getSrcDeployEvent(srcDeployBlock)  
//             const dstImmutables = srcEscrowEvent[0]  
//                 .withComplement(srcEscrowEvent[1])  
//                 .withTaker(new Sdk.Address(this.dstAddress))  
  
//             const {blockTimestamp: dstDeployedAt} = await this.deployDst(dstImmutables)  
  
//             // Calculate escrow addresses  
//             const ESCROW_SRC_IMPLEMENTATION = await this.srcFactory.getSourceImpl()  
//             const ESCROW_DST_IMPLEMENTATION = await this.dstFactory.getDestinationImpl()  
  
//             const srcEscrowAddress = new Sdk.EscrowFactory(new Sdk.Address(this.srcAddress)).getSrcEscrowAddress(  
//                 srcEscrowEvent[0],  
//                 ESCROW_SRC_IMPLEMENTATION  
//             )  
  
//             const dstEscrowAddress = new Sdk.EscrowFactory(new Sdk.Address(this.dstAddress)).getDstEscrowAddress(  
//                 srcEscrowEvent[0],  
//                 srcEscrowEvent[1],  
//                 dstDeployedAt,  
//                 new Sdk.Address(this.dstAddress),  
//                 ESCROW_DST_IMPLEMENTATION  
//             )  
  
//             // Wait for cancellation period  
//             console.log(`Waiting for cancellation period...`)  
//             await this.increaseTime(125)  
  
//             // Cancel both escrows  
//             await this.cancel('dst', dstEscrowAddress, dstImmutables.withDeployedAt(dstDeployedAt))  
//             await this.cancel('src', srcEscrowAddress, srcEscrowEvent[0])  
  
//             console.log(`Cancellation completed - funds returned to original owners`)  
  
//         } catch (error) {  
//             console.error(`Cancellation failed:`, error)  
//             throw error  
//         }  
//     }  
  
//     // Helper method to simulate time passage  
//     private async increaseTime(seconds: number): Promise<void> {  
//         // This would interact with test blockchain time manipulation  
//         // In production, this would be actual time waiting  
//         console.log(`Simulating ${seconds} seconds time passage`)  
//     }  
// }  
  
// // Factory function to create resolver service  
// export async function createResolverService(  
//     srcAddress: string,  
//     dstAddress: string,  
//     srcChainResolver: any,  
//     dstChainResolver: any,  
//     srcFactory: any,  
//     dstFactory: any  
// ): Promise<ResolverService> {  
//     return new ResolverService(  
//         srcAddress,  
//         dstAddress,  
//         srcChainResolver,  
//         dstChainResolver,  
//         srcFactory,  
//         dstFactory  
//     )  
// }  
  
// // Example usage script  
// export async function runResolverSimulation() {  
//     // This would be initialized with actual chain setup  
//     // Similar to the test setup in main.spec.ts  
      
//     console.log('Initializing resolver service...')  
      
//     // Create resolver service instance  
//     const resolverService = await createResolverService(  
//         'src_resolver_address',  
//         'dst_resolver_address',  
//         'src_chain_resolver_wallet',  
//         'dst_chain_resolver_wallet',  
//         'src_factory_instance',  
//         'dst_factory_instance'  
//     )  
  
//     // Example order creation (simplified)  
//     const secret = uint8ArrayToHex(randomBytes(32))  
//     const order = createExampleOrder(secret)  
//     const signature = 'signed_order_signature'  
//     const fillAmount = parseUnits('100', 6)  
  
//     // Run complete swap simulation  
//     await resolverService.simulateCompleteSwap(  
//         1, // Ethereum  
//         56, // BSC  
//         order,  
//         signature,  
//         secret,  
//         fillAmount  
//     )  
// }  
  
// function createExampleOrder(secret: string): Sdk.CrossChainOrder {  
//     // This would create a proper CrossChainOrder  
//     // Based on the pattern shown in main.spec.ts  
//     return {} as Sdk.CrossChainOrder // Placeholder  
// }