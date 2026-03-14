import React from "react";
import { Wallet } from "lucide-react";

export function NoWalletDetected() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl max-w-md w-full">
        <div className="card-body items-center text-center gap-4">
          <div className="text-6xl">🐾</div>
          <Wallet className="h-12 w-12 text-error" />
          <h2 className="card-title text-2xl">No Wallet Found</h2>
          <p className="text-base-content/70">
            No Ethereum wallet was detected. Install one to get started.
          </p>
          <div className="flex gap-3 flex-wrap justify-center mt-2">
            <a
              href="https://metamask.io"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              MetaMask
            </a>
            <a
              href="https://www.coinbase.com/wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-primary"
            >
              Coinbase Wallet
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
