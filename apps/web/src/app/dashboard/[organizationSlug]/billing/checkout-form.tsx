"use client";

import { useState } from "react";
import styles from "./billing.module.css";

type Plan = "starter" | "pro";
type Requester = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function requestCheckout(
  organizationSlug: string,
  plan: Plan,
  requester: Requester = fetch,
  idempotencyKey = crypto.randomUUID(),
): Promise<string> {
  const response = await requester("/api/v1/billing/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ organizationSlug, plan }),
  });
  const body = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null;
  if (!response.ok || typeof body?.url !== "string") {
    throw new Error(typeof body?.error === "string" ? body.error : "Checkout could not start.");
  }
  return body.url;
}

export function CheckoutForm({
  organizationSlug,
  plan,
  navigate,
}: {
  organizationSlug: string;
  plan: Plan;
  navigate?: (url: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setPending(true);
    setError("");
    try {
      const redirect = navigate ?? window.location.assign.bind(window.location);
      redirect(await requestCheckout(organizationSlug, plan));
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not start.");
      setPending(false);
    }
  }

  return (
    <div className={styles.checkoutForm}>
      <button type="button" disabled={pending} onClick={checkout}>
        {pending ? "Opening secure checkout…" : `Choose ${plan}`}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
