import { useState } from "react";
import { useUnifiedSigner } from "../utils/wallet";
import { createCrossChainOrder, signCrossChainOrder } from "../utils/createCrossChainOrder";
import { executePhase2 } from "../utils/resolverOperations";

export default function SignOrderButton() {
  const { signer, address } = useUnifiedSigner();
  const [isLoading, setIsLoading] = useState(false);
  const [isPhase2Loading, setIsPhase2Loading] = useState(false);
  const [swapAmount, setSwapAmount] = useState("0.01");
  const [swapDirection, setSwapDirection] = useState<"WETH_TO_WMON" | "WMON_TO_WETH">("WETH_TO_WMON");

  const handleCreateOrder = async () => {
    if (!signer || !address) {
      alert("Connect wallet first");
      return;
    }

    try {
      setIsLoading(true);
      console.log("🚀 Starting Phase 1: Cross-chain order creation...");
      
      // Step 1: Create cross-chain order with dynamic amount from frontend
      console.log(`👤 User address: ${address}`);
      console.log(`💰 Swap amount: ${swapAmount} ${swapDirection.split('_')[0]}`);
      console.log(`🔄 Direction: ${swapDirection}`);

      const orderData = await createCrossChainOrder(address, swapAmount, swapDirection);
      
      // Step 2: Sign the order (mirrors test script's signOrder call)
      const chainId = swapDirection === "WETH_TO_WMON" ? 421614 : 10143;
      const signatureData = await signCrossChainOrder(signer, orderData.order, chainId);

      // Display results in console (Phase 1 objective)
      console.log("✅ Phase 1 Complete - Order Created and Signed!");
      console.log("📋 Order Details:", {
        orderHash: signatureData.orderHash,
        signature: signatureData.signature,
        swapDirection: orderData.swapDirection,
        makingAmount: `${orderData.makingAmount} ${swapDirection.split('_')[0]}`,
        takingAmount: `${orderData.takingAmount} ${swapDirection.split('_')[2]}`,
        takerAddress: `${orderData.order.takerAsset}`,
        makerAddress: `${orderData.order.makerAsset}`,
        secret: orderData.secret
      });

      // Store for next phases
      (window as any).orderData = {
        order: orderData.order,
        signature: signatureData.signature,
        secret: orderData.secret,
        orderHash: signatureData.orderHash,
        swapDirection: orderData.swapDirection,
        chainId
      };

      alert(`✅ Order created! Order hash: ${signatureData.orderHash.slice(0, 10)}...`);

    } catch (error) {
      console.error("❌ Error creating order:", error);
      alert("Failed to create order. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhase2 = async () => {
    const orderData = (window as any).orderData;
    console.log("📋 Phase 2 data:", orderData);
    if (!orderData) {
      alert("Please complete Phase 1 first");
      return;
    }

    try {
      setIsPhase2Loading(true);
      console.log("🚀 Starting Phase 2 with order data:", orderData);
      
      const result = await executePhase2(orderData);
      
      alert(`✅ Phase 2 Complete! Tx: ${result.txHash?.slice(0, 10)}...`);
      console.log("🎉 Phase 2 Results:", result);
      
    } catch (error) {
      console.error("❌ Phase 2 failed:", error);
      alert("Phase 2 failed. Check console for details.");
    } finally {
      setIsPhase2Loading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Create Cross-Chain Order</h3>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium">Swap Direction:</label>
        <select 
          value={swapDirection} 
          onChange={(e) => setSwapDirection(e.target.value as any)}
          className="w-full p-2 border rounded"
        >
          <option value="WETH_TO_WMON">WETH → WMON (1 WETH = 0.9 WMON)</option>
          <option value="WMON_TO_WETH">WMON → WETH (0.9 WMON = 1 WETH)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Amount:</label>
        <input
          type="number"
          step="0.001"
          min="0.001"
          max="10"
          value={swapAmount}
          onChange={(e) => setSwapAmount(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="0.01"
        />
        <p className="text-sm text-gray-600">
          You will receive: {
            swapDirection === "WETH_TO_WMON" 
              ? (parseFloat(swapAmount) * 0.9).toFixed(4) 
              : (parseFloat(swapAmount) / 0.9).toFixed(4)
          } {swapDirection.split('_')[2]}
        </p>
      </div>

      <button
        className={`w-full px-4 py-2 rounded font-medium ${
          isLoading 
            ? "bg-gray-400 cursor-not-allowed" 
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
        onClick={handleCreateOrder}
        disabled={isLoading || !signer || !address}
      >
        {isLoading ? "Creating Order..." : "Phase 1: Create & Sign Order"}
      </button>

      <button
        className={`w-full px-4 py-2 rounded font-medium ${
          isPhase2Loading 
            ? "bg-gray-400 cursor-not-allowed" 
            : "bg-green-600 hover:bg-green-700 text-white"
        }`}
        onClick={handlePhase2}
        disabled={isPhase2Loading}
      >
        {isPhase2Loading ? "Deploying Escrow..." : "Phase 2: Fill Order & Deploy Source Escrow"}
      </button>

      {!address && (
        <p className="text-sm text-red-600">Please connect your wallet first</p>
      )}
    </div>
  );
}
