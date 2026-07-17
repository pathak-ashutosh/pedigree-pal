import "server-only";

import Stripe from "stripe";
import { getBillingEnv } from "@/lib/env";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getBillingEnv().STRIPE_SECRET_KEY, {
      appInfo: { name: "PedigreePal", version: "0.1.0" },
    });
  }
  return stripeClient;
}
