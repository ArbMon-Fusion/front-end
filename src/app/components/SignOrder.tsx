import { useUnifiedSigner } from "../utils/wallet";


export default function SignOrderButton() {
  const { signer, address } = useUnifiedSigner();

  const handleClick = async () => {
    if (!signer || !address) {
      alert("Connect wallet first");
      return;
    }

    const message = "Sign this message to prove ownership";
    const signature = await signer.signMessage(message);

    console.log("Signature:", signature);
  };

  return (
    <button
      className="bg-purple-600 text-white px-4 py-2 rounded"
      onClick={handleClick}
    >
      Sign Order
    </button>
  );
}
