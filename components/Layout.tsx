import React from "react";
import dynamic from "next/dynamic";

type LayoutProps = {
  children: React.ReactNode;
};

const ConnectWalletButton = dynamic(
  () => import("../components/ConnectWalletButton"),
  {
    ssr: false,
  }
);

/**
 * The main layout of the app, with a dark theme and a subtle background gradient animation.
 * Removed the gradient heading text. Using a simpler, classy style for the title.
 */
export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col animate-background bg-gradient-to-br from-blue via-emerald-400 to-[#0B0B10]">
      {/* Header / Nav */}
      <header className="py-6 px-6 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
          Crypto Payment Gateway
        </h1>

        {/* Connect Wallet Button in the top-right */}
        <div>
          <ConnectWalletButton />
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-grow flex flex-col items-center justify-center">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-gray-400"></footer>
    </div>
  );
}
