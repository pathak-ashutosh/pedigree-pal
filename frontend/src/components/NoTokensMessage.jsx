import React from "react";

export function NoTokensMessage() {
  return (
    <div className="text-center py-12 text-base-content/50">
      <div className="text-6xl mb-4">🐕</div>
      <p className="text-lg font-medium">What would you like to do?</p>
      <p className="text-sm mt-1">Register a new dog or look up an existing pedigree.</p>
    </div>
  );
}
