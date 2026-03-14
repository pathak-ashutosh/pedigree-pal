import React, { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";

export function DogCertificateCard({ dogId, name, breed, sex, age, mother, father, owner }) {
  const [copied, setCopied] = useState(false);

  function copyOwner() {
    navigator.clipboard.writeText(owner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sexLabel = sex === "M" ? "Male 🐕" : sex === "F" ? "Female 🐩" : sex;

  return (
    <div className="card bg-base-100 shadow-xl border border-primary/20 w-full max-w-lg mx-auto mt-6 animate-fade-in">
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="card-title text-2xl">{name}</h2>
            <p className="text-base-content/60 text-sm">Dog #{dogId}</p>
          </div>
          <div className="badge badge-success gap-1 py-3 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verified On-Chain
          </div>
        </div>

        <div className="divider my-0" />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-base-content/50 font-medium uppercase tracking-wide text-xs">Breed</dt>
            <dd className="font-semibold mt-0.5">{breed}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 font-medium uppercase tracking-wide text-xs">Sex</dt>
            <dd className="font-semibold mt-0.5">{sexLabel}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 font-medium uppercase tracking-wide text-xs">Age</dt>
            <dd className="font-semibold mt-0.5">{age} {age === "1" ? "year" : "years"}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 font-medium uppercase tracking-wide text-xs">Dog ID</dt>
            <dd className="font-semibold mt-0.5">#{dogId}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 font-medium uppercase tracking-wide text-xs">Mother ID</dt>
            <dd className="font-semibold mt-0.5">#{mother}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 font-medium uppercase tracking-wide text-xs">Father ID</dt>
            <dd className="font-semibold mt-0.5">#{father}</dd>
          </div>
        </dl>

        <div className="divider my-0" />

        <div>
          <p className="text-base-content/50 font-medium uppercase tracking-wide text-xs mb-1">Owner</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-base-content/80 truncate flex-1">{owner}</span>
            <button
              className="btn btn-ghost btn-xs gap-1 shrink-0"
              onClick={copyOwner}
              title="Copy address"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
