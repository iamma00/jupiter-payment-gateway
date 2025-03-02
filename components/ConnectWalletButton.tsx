import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/**
 * A simple wrapper around the standard Solana WalletMultiButton
 */
export default function ConnectWalletButton() {
  return (
    <div>
      <WalletMultiButton className="myWalletButton" />
    </div>
  );
}
