import React, { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export function SuccessToast({ dog, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="toast toast-top toast-end z-50">
      <div className="alert alert-success shadow-lg">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Dog registered! 🐾</p>
          <p className="text-sm opacity-80">{dog.name} is now on-chain.</p>
        </div>
        <button className="btn btn-ghost btn-xs btn-circle" onClick={onDone}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
