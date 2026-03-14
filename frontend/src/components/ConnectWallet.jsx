import React from "react";
import { Wallet, PawPrint } from "lucide-react";
import { NetworkErrorMessage } from "./NetworkErrorMessage";

export function ConnectWallet({ connectWallet, networkError, dismiss }) {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4 gap-6">
      {networkError && (
        <div className="w-full max-w-sm">
          <NetworkErrorMessage message={networkError} dismiss={dismiss} />
        </div>
      )}
      <div className="text-8xl select-none animate-bounce">🐾</div>
      <div className="card bg-base-100 shadow-xl max-w-sm w-full">
        <div className="card-body items-center text-center gap-4">
          <PawPrint className="h-10 w-10 text-primary" />
          <h1 className="card-title text-3xl font-extrabold text-primary">PedigreePal</h1>
          <p className="text-base-content/60 text-sm">
            The on-chain pedigree registry for dogs. Connect your wallet to register or look up a dog's lineage.
          </p>
          <button
            className="btn btn-primary btn-wide gap-2 mt-2"
            type="button"
            onClick={connectWallet}
          >
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
