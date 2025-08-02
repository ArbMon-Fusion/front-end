#!/usr/bin/env ts-node

import * as dotenv from 'dotenv'
dotenv.config()

import {
    Contract,
    Interface,
    JsonRpcProvider,
    formatEther,
    parseEther,
    MaxUint256
} from 'ethers'
import { Wallet } from './tests/wallet'

// Contract addresses
const RESOLVER_CONTRACT = '0xF1bF3e727Cb948C19d9D3b8c0a73cDf0a822bb04'
const WETH_ADDRESS = '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73' // WETH on Arbitrum Sepolia

async function withdrawResolverFunds() {
    console.log('🚀 Starting withdrawal of WETH from Resolver contract on Arbitrum Sepolia...\n')

    // Initialize provider and wallet
    const provider = new JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC, 421614)
    const resolverWallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider)

    console.log('📍 Resolver EOA:', await resolverWallet.getAddress())
    console.log('📍 Resolver Contract:', RESOLVER_CONTRACT)
    console.log('📍 WETH Token:', WETH_ADDRESS)
    console.log()

    // Check current balances
    const wethContract = new Contract(
        WETH_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256)'],
        provider
    )

    const resolverEOABalance = await wethContract.balanceOf(await resolverWallet.getAddress())
    const resolverContractBalance = await wethContract.balanceOf(RESOLVER_CONTRACT)

    console.log('💰 Current WETH Balances:')
    console.log(`   Resolver EOA: ${formatEther(resolverEOABalance)} WETH`)
    console.log(`   Resolver Contract: ${formatEther(resolverContractBalance)} WETH`)
    console.log()

    if (resolverContractBalance === 0n) {
        console.log('❌ No WETH to withdraw from resolver contract')
        return
    }

    // Create interfaces for the calls
    const resolverInterface = new Interface(['function arbitraryCalls(address[],bytes[]) external'])
    const erc20Interface = new Interface(['function transfer(address,uint256)'])

    // Create transfer call data to send WETH from resolver contract to resolver EOA
    const transferCallData = erc20Interface.encodeFunctionData('transfer', [
        await resolverWallet.getAddress(),
        resolverContractBalance
    ])

    // Create arbitraryCalls transaction
    const arbitraryCallsData = resolverInterface.encodeFunctionData('arbitraryCalls', [
        [WETH_ADDRESS],
        [transferCallData]
    ])

    console.log(`🔄 Withdrawing ${formatEther(resolverContractBalance)} WETH from resolver contract...`)

    try {
        const { txHash } = await resolverWallet.send({
            to: RESOLVER_CONTRACT,
            data: arbitraryCallsData
        })

        console.log(`✅ Withdrawal successful!`)
        console.log(`📄 Transaction: ${txHash}`)
        console.log()

        // Check final balances
        const finalEOABalance = await wethContract.balanceOf(await resolverWallet.getAddress())
        const finalContractBalance = await wethContract.balanceOf(RESOLVER_CONTRACT)

        console.log('💰 Final WETH Balances:')
        console.log(`   Resolver EOA: ${formatEther(finalEOABalance)} WETH`)
        console.log(`   Resolver Contract: ${formatEther(finalContractBalance)} WETH`)
        console.log()

        const withdrawn = finalEOABalance - resolverEOABalance
        console.log(`🎉 Successfully withdrawn ${formatEther(withdrawn)} WETH from resolver contract!`)

    } catch (error) {
        console.error('❌ Withdrawal failed:', error)
    }
}

// Also export a function to withdraw native ETH/MON
async function withdrawNativeTokens(amount: bigint) {
    console.log(`🚀 Starting withdrawal of ${formatEther(amount)} native tokens from Resolver contract...\n`)

    const provider = new JsonRpcProvider('https://arb-sepolia.g.alchemy.com/v2/TRxeW47imEqxxdPubmvTuhcG334Udxb0', 421614)
    const resolverWallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider)

    // Check contract balance
    const contractBalance = await provider.getBalance(RESOLVER_CONTRACT)
    console.log(`💰 Resolver contract native balance: ${formatEther(contractBalance)} ETH`)

    if (contractBalance === 0n) {
        console.log('❌ No native tokens to withdraw from resolver contract')
        return
    }

    const withdrawAmount = amount > contractBalance ? contractBalance : amount

    const resolverInterface = new Interface(['function arbitraryCalls(address[],bytes[]) external'])

    // Create arbitraryCalls transaction to send native tokens
    const arbitraryCallsData = resolverInterface.encodeFunctionData('arbitraryCalls', [
        [await resolverWallet.getAddress()],
        ['0x'] // Empty data for native token transfer
    ])

    try {
        const { txHash } = await resolverWallet.send({
            to: RESOLVER_CONTRACT,
            data: arbitraryCallsData,
            value: withdrawAmount
        })

        console.log(`✅ Native token withdrawal successful!`)
        console.log(`📄 Transaction: ${txHash}`)
        console.log(`🎉 Withdrawn ${formatEther(withdrawAmount)} native tokens!`)

    } catch (error) {
        console.error('❌ Native token withdrawal failed:', error)
    }
}

// Main execution
if (require.main === module) {
    withdrawResolverFunds().catch(console.error)
}

export { withdrawResolverFunds, withdrawNativeTokens }
