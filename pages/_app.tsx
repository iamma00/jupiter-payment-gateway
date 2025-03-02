import type { AppProps } from "next/app";
import { useMemo } from "react";
import { ToastContainer, toast } from "react-toastify";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  SolflareWalletAdapter,
  PhantomWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import "../styles/global.css";

/**
 * Choose an RPC.
 * For mainnet, Jupiter recommends a stable provider.
 */
const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export default function App({ Component, pageProps }: AppProps) {
  // You can add multiple wallets:
  const wallets = useMemo(
    () => [new SolflareWalletAdapter(), new PhantomWalletAdapter()],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex flex-col">
      <header className="w-full py-4 text-center bg-emerald-700 shadow-md">
        <h1 className="text-2xl font-bold tracking-wide">
          Solana Crypto Payment Gateway
        </h1>
      </header>
      <ConnectionProvider endpoint={RPC_URL}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <main className="flex-grow flex items-center justify-center p-6">
              <Component {...pageProps} />
            </main>
            <ToastContainer />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
      <footer className="text-center p-4 bg-emerald-900 text-sm opacity-80"></footer>
    </div>
  );
}
