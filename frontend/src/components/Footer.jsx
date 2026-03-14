import React from "react";
import { PawPrint } from "lucide-react";

export function Footer({ contractAddr }) {
  const short = contractAddr
    ? `${contractAddr.slice(0, 8)}...${contractAddr.slice(-6)}`
    : null;

  return (
    <footer className="footer footer-center bg-base-300 text-base-content/50 p-4 text-xs">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <PawPrint className="h-3.5 w-3.5" />
        <span className="font-semibold">PedigreePal</span>
        {short && (
          <>
            <span>·</span>
            <span className="font-mono">Contract: {short}</span>
          </>
        )}
        <span>·</span>
        <span>Hardhat Local Network</span>
      </div>
    </footer>
  );
}
