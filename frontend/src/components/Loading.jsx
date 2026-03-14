import React from "react";
import { PawPrint } from "lucide-react";

export function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-100/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <PawPrint className="h-14 w-14 text-primary animate-bounce" />
        <span className="loading loading-dots loading-lg text-primary" />
        <p className="text-base-content/60 text-sm font-medium">Connecting to the chain...</p>
      </div>
    </div>
  );
}
