import React from "react";
import { AlertCircle, X } from "lucide-react";

export function TransactionErrorMessage({ message, dismiss }) {
  return (
    <div role="alert" className="alert alert-error shadow-md mb-4">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Transaction failed</p>
        <p className="text-sm opacity-80">{message.substring(0, 100)}</p>
      </div>
      <button className="btn btn-ghost btn-xs btn-circle" onClick={dismiss}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
