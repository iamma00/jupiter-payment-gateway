/**
 * Client-side Jupiter helpers:
 * You do NOT need any server-side private key for these calls.
 */

import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import fetch from "cross-fetch";

/**
 * For demonstration, you can set a mainnet endpoint or fetch from your environment:
 */
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://rpc.ankr.com/solana";

/**
 * The standard USDC mint on Solana:
 */
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

/**
 * The "Native SOL" pseudo-mint for Jupiter's usage:
 */
export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

/**
 * Create your web3.js `Connection`.
 */
export const connection = new Connection(RPC_ENDPOINT);

/**
 * Check if a token account exists.
 */
export const checkIfTokenAccountExists = async (
  connection: Connection,
  receiverTokenAccountAddress: PublicKey
): Promise<boolean> => {
  try {
    await getAccount(
      connection,
      receiverTokenAccountAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    return true;
  } catch (thrownObject) {
    const error = thrownObject as Error;
    if (error.name === "TokenAccountNotFoundError") {
      return false;
    }
    throw error;
  }
};

/**
 * Get a Jupiter “ExactOut” quote.
 * If you want "outAmount" USDC, Jupiter returns how much SOL is needed.
 */
export async function getExactOutQuote(
  outAmountAtomic: number,
  jupiterApiKey?: string
): Promise<{
  inAmountLamports: number;
  quoteResponse: any;
  error?: string;
}> {
  try {
    const apiKey = jupiterApiKey || process.env.JUPITER_API_KEY;
    const url = new URL("https://api.jup.ag/swap/v1/quote");
    url.searchParams.set("inputMint", SOL_MINT.toBase58());
    url.searchParams.set("outputMint", USDC_MINT.toBase58());
    url.searchParams.set("amount", outAmountAtomic.toString());
    url.searchParams.set("swapMode", "ExactOut");
    url.searchParams.set("slippageBps", "50");
    url.searchParams.set("restrictIntermediateTokens", "true");

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
    });

    if (!resp.ok) {
      if (resp.status === 403) {
        return {
          inAmountLamports: 0,
          quoteResponse: null,
          error:
            "Access forbidden (403). Check Jupiter API key or free plan usage.",
        };
      }
      return {
        inAmountLamports: 0,
        quoteResponse: null,
        error: `Failed to fetch quote. Status code: ${resp.status}`,
      };
    }

    const data = await resp.json();
    if (data.error) {
      return {
        inAmountLamports: 0,
        quoteResponse: null,
        error: data.error,
      };
    }

    const inLamports = Number(data.inAmount || 0);
    return {
      inAmountLamports: inLamports,
      quoteResponse: data,
    };
  } catch (err: any) {
    return {
      inAmountLamports: 0,
      quoteResponse: null,
      error: err?.message ?? "Unknown error",
    };
  }
}

/**
 * Build a Jupiter swap transaction with EXACT OUT from SOL -> USDC.
 * The destinationTokenAccount is now provided by the user.
 */
export async function buildSwapTransaction({
  quoteResponse,
  userPublicKey,
  destinationTokenAccount,
  jupiterApiKey,
}: {
  quoteResponse: any;
  userPublicKey: PublicKey;
  destinationTokenAccount: string;
  jupiterApiKey?: string;
}): Promise<VersionedTransaction> {
  const apiKey = jupiterApiKey || process.env.JUPITER_API_KEY;
  const resp = await fetch("https://api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: userPublicKey.toBase58(),
      destinationTokenAccount,
      wrapAndUnwrapSol: true,
      dynamicSlippage: { maxBps: 300 },
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1_000_000,
          priorityLevel: "high",
        },
      },
    }),
  });

  if (!resp.ok) {
    throw new Error(`Failed to build swap transaction. Status: ${resp.status}`);
  }

  const swapData = await resp.json();

  if (swapData.error) {
    throw new Error(swapData.error);
  }

  if (swapData.simulationError) {
    throw new Error(
      `Simulation Error: ${JSON.stringify(swapData.simulationError)}`
    );
  }

  const { swapTransaction } = swapData;
  if (!swapTransaction) {
    throw new Error("No swapTransaction returned from Jupiter");
  }

  const txBuffer = Buffer.from(swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuffer);

  return tx;
}