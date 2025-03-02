import React, { useState, useEffect } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getExactOutQuote, buildSwapTransaction } from "../lib/jupiter";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";

/**
 * PaymentCard:
 * - Users input USDC amount & merchant's USDC token account.
 * - Estimates required SOL using Jupiter's ExactOut mode.
 * - Builds, signs, and executes the swap transaction.
 * - Provides real-time feedback on success or errors.
 */
export default function PaymentCard() {
  const [amount, setAmount] = useState("1.0");
  const [merchantUSDCAccount, setMerchantUSDCAccount] = useState("");
  const [estimatedSol, setEstimatedSol] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("0.0");
  const [convertedUSDC, setConvertedUSDC] = useState("");
  type Token = {
    mint: string;
    amount: number;
    symbol: string;
  };

  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState("");

  // Wallet hooks
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  useEffect(() => {
    if (publicKey) {
      fetchTokens();
    }
  }, [publicKey]);

  const fetchTokens = async () => {
    try {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: new PublicKey(
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
          ),
        }
      );
      const tokens = tokenAccounts.value.map((account) => {
        const tokenInfo = account.account.data.parsed.info;
        return {
          mint: tokenInfo.mint,
          amount: tokenInfo.tokenAmount.uiAmount,
          symbol: tokenInfo.symbol || "Unknown",
        };
      });
      setTokens(tokens);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
    }
  };

  // Estimate SOL required for the given USDC amount
  const handleEstimate = async () => {
    if (!amount) return;
    setLoading(true);
    setEstimatedSol("");
    setTxSignature("");
    setError("");
    try {
      const outAmountAtomic = Number(amount) * 1_000_000;
      const { inAmountLamports, error: quoteError } = await getExactOutQuote(
        outAmountAtomic
      );
      if (quoteError) return setError(quoteError);
      setEstimatedSol((inAmountLamports / 1_000_000_000).toFixed(6));
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Estimation failed.");
        toast.error(err.message || "Estimation failed.");
      } else {
        setError("Estimation failed.");
        toast.error("Estimation failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Build & execute transaction
  const handlePay = async () => {
    if (!publicKey) {
      const errorMessage = "Connect your wallet first!";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }
    if (!amount || !merchantUSDCAccount) {
      const errorMessage = "Enter required details.";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }
    setLoading(true);
    setError("");
    setTxSignature("");
    try {
      const outAmountAtomic = Number(amount) * 1_000_000;
      const { quoteResponse } = await getExactOutQuote(outAmountAtomic);
      if (!quoteResponse) {
        const errorMessage = "No quote available.";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      const transaction = await buildSwapTransaction({
        quoteResponse,
        userPublicKey: publicKey,
        destinationTokenAccount: merchantUSDCAccount,
      });

      if (!signTransaction)
        throw new Error("Wallet does not support transaction signing.");
      const signedTx = await signTransaction(transaction);
      const rawTx = signedTx.serialize();
      const latestBlockhash = await connection.getLatestBlockhash();
      const txid = await connection.sendRawTransaction(rawTx, {
        maxRetries: 5,
      });

      await connection.confirmTransaction(
        {
          signature: txid,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "finalized"
      );

      setTxSignature(txid);
      toast.success("Transaction successful!");
    } catch (err) {
      if (err instanceof Error) {
        const errorMessage = err.message || "Transaction failed.";
        setError(errorMessage);
        toast.error(errorMessage);
      } else {
        const errorMessage = "Transaction failed.";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle token to USDC conversion
  const handleTokenConversion = async () => {
    if (!tokenAmount || !selectedToken) return;
    setLoading(true);
    setConvertedUSDC("");
    setError("");
    try {
      const tokenAmountAtomic = Number(tokenAmount) * 1_000_000;
      const { inAmountLamports, error: quoteError } = await getExactOutQuote(
        tokenAmountAtomic,
        selectedToken
      );
      if (quoteError) return setError(quoteError);
      setConvertedUSDC((inAmountLamports / 1_000_000).toFixed(6));
    } catch (err) {
      if (err instanceof Error) {
        const errorMessage = err.message || "Conversion failed.";
        setError(errorMessage);
        toast.error(errorMessage);
      } else {
        const errorMessage = "Conversion failed.";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-700 via-green-800 to-green-900 p-8 rounded-3xl shadow-lg border border-white/20 transition-transform duration-300 hover:scale-105 hover:shadow-lg max-w-lg mx-auto">
      <h2 className="text-3xl font-bold text-center text-white mb-6">
        Pay in SOL, Get USDC
      </h2>

      <label className="block text-white mb-2">Select Token</label>
      <select
        className="w-full px-4 py-3 rounded-md text-black"
        value={selectedToken}
        onChange={(e) => setSelectedToken(e.target.value)}
      >
        <option value="">Select a token</option>
        {tokens.map((token) => (
          <option key={token.mint} value={token.mint}>
            {token.symbol} ({token.amount})
          </option>
        ))}
      </select>

      <label className="block text-white mt-4 mb-2">Token Amount</label>
      <input
        type="number"
        step="0.000001"
        className="w-full px-4 py-3 rounded-md text-black"
        value={tokenAmount}
        onChange={(e) => setTokenAmount(e.target.value)}
      />
      <button
        onClick={handleTokenConversion}
        className="w-full py-3 mt-2 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition"
      >
        Convert to USDC
      </button>
      {convertedUSDC && (
        <p className="text-white mt-2 text-center">
          Converted: {convertedUSDC} USDC
        </p>
      )}

      <label className="block text-white mt-4 mb-2">USDC Amount</label>
      <input
        type="number"
        step="0.000001"
        className="w-full px-4 py-3 rounded-md text-black"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <label className="block text-white mt-4 mb-2">
        Merchant USDC Account
      </label>
      <input
        type="text"
        className="w-full px-4 py-3 rounded-md text-black"
        value={merchantUSDCAccount}
        onChange={(e) => setMerchantUSDCAccount(e.target.value)}
      />

      <button
        onClick={handleEstimate}
        className="w-full py-3 mt-6 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition"
      >
        Estimate SOL Required
      </button>
      {estimatedSol && (
        <p className="text-white mt-2 text-center">
          Estimated: {estimatedSol} SOL
        </p>
      )}

      <button
        onClick={handlePay}
        className="w-full py-3 mt-4 bg-black text-white font-semibold rounded-md hover:bg-gray-800 transition"
      >
        Pay in SOL
      </button>

      {error && <p className="text-red-300 mt-4 text-center">Error: {error}</p>}
      {txSignature && (
        <p className="text-green-300 mt-4 text-center">
          Success!{" "}
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            className="underline"
          >
            View on Solscan
          </a>
        </p>
      )}
      <ToastContainer theme="dark" />
    </div>
  );
}
