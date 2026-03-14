import React from "react";
import { AlertCircle, X } from "lucide-react";

export function NetworkErrorMessage({ message, dismiss }) {
  return (
    <div role="alert" className="alert alert-error shadow-md mb-4">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
      <button className="btn btn-ghost btn-xs btn-circle" onClick={dismiss}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
