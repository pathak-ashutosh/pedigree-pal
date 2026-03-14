import React from "react";
import { Loader2 } from "lucide-react";

export function WaitingForTransactionMessage({ txHash }) {
  return (
    <div role="alert" className="alert alert-info shadow-md mb-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
      <div>
        <p className="font-semibold">Mining transaction...</p>
        <p className="text-xs font-mono break-all opacity-70">{txHash}</p>
      </div>
    </div>
  );
}
