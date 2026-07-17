import { vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ Stripe: vi.fn(function StripeClient() {}) }));

vi.mock("stripe", () => ({ default: mocks.Stripe }));
vi.mock("@/lib/env", () => ({
  getBillingEnv: () => ({ STRIPE_SECRET_KEY: "sk_test_123" }),
}));

import { getStripe } from "./stripe";

describe("Stripe client", () => {
  it("creates one identified client", () => {
    expect(getStripe()).toBe(getStripe());
    expect(mocks.Stripe).toHaveBeenCalledOnce();
    expect(mocks.Stripe).toHaveBeenCalledWith("sk_test_123", {
      appInfo: { name: "PedigreePal", version: "0.1.0" },
    });
  });
});
