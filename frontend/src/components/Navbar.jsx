import React from "react";
import { PawPrint, LogOut } from "lucide-react";

export function Navbar({ selectedAddress, onDisconnect }) {
  const short = selectedAddress
    ? `${selectedAddress.slice(0, 6)}...${selectedAddress.slice(-4)}`
    : null;

  return (
    <div className="navbar bg-primary text-primary-content shadow-md sticky top-0 z-40 px-4">
      <div className="navbar-start gap-2">
        <PawPrint className="h-7 w-7" />
        <span className="text-xl font-extrabold tracking-tight">PedigreePal</span>
      </div>
      {short && (
        <div className="navbar-end gap-3">
          <div className="badge badge-accent font-mono text-xs px-3 py-4 hidden sm:flex">
            {short}
          </div>
          <button
            className="btn btn-ghost btn-sm gap-1 text-primary-content hover:bg-primary-content/10"
            onClick={onDisconnect}
            title="Disconnect"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
