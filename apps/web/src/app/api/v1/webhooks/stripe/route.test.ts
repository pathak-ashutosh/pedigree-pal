import { vi } from "vitest";

vi.mock("@/lib/billing/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ getBillingEnv: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createStripeWebhookHandler } from "./route";
import { hashRequestPayload } from "@/lib/server/idempotency";

type Query = Record<string, ReturnType<typeof vi.fn>>;

function query(result: unknown = { data: null, error: null }): Query {
  const builder: Query = {};
  for (const method of ["insert", "upsert", "update", "select", "eq"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

function webhookRequest(signature = "valid_signature"): Request {
  return new Request("https://app.example.test/api/v1/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: JSON.stringify({ id: "evt_1" }),
  });
}

const checkoutEvent = {
  id: "evt_checkout",
  type: "checkout.session.completed",
  data: {
    object: {
      client_reference_id: "org-1",
      customer: "cus_1",
      subscription: "sub_1",
      metadata: { plan: "pro" },
    },
  },
};
const requestPayloadHash = hashRequestPayload(JSON.stringify({ id: "evt_1" }));

const subscriptionEvent = {
  id: "evt_subscription",
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { organization_id: "org-1" },
      items: { data: [{ price: { id: "price_starter" } }] },
    },
  },
};

function setup({
  event = checkoutEvent,
  queries = [],
  signatureError = false,
}: {
  event?: typeof checkoutEvent | typeof subscriptionEvent | {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  queries?: Query[];
  signatureError?: boolean;
} = {}) {
  const from = vi.fn();
  queries.forEach((builder) => from.mockReturnValueOnce(builder));
  const constructEvent = signatureError
    ? vi.fn(() => { throw new Error("bad signature"); })
    : vi.fn(() => event);
  const activeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const handler = createStripeWebhookHandler({
    admin: (() => ({ from })) as never,
    stripe: (() => ({ webhooks: { constructEvent } })) as never,
    billingEnv: (() => ({
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_PRICE_STARTER: "price_starter",
      STRIPE_PRICE_PRO: "price_pro",
    })) as never,
    requestId: (() => "request-1") as never,
    activeLogger: activeLogger as never,
  });
  return { handler, from, constructEvent, activeLogger };
}

describe("Stripe webhook API", () => {
  it("requires and verifies the provider signature", async () => {
    const missing = setup();
    expect((await missing.handler(webhookRequest(""))).status).toBe(400);
    expect(missing.constructEvent).not.toHaveBeenCalled();

    const invalid = setup({ signatureError: true });
    expect((await invalid.handler(webhookRequest())).status).toBe(400);
    expect(invalid.activeLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.webhook_signature_invalid" }),
      "billing webhook rejected",
    );
  });

  it("returns processed duplicates without applying billing twice", async () => {
    const claim = query({ data: null, error: { code: "23505" } });
    const existing = query({
      data: { processed_at: "2026-07-15T00:00:00Z", payload_hash: requestPayloadHash },
      error: null,
    });
    const current = setup({ queries: [claim, existing] });
    const response = await current.handler(webhookRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(current.from).toHaveBeenCalledTimes(2);
  });

  it("fails safely when claim state is unavailable", async () => {
    const duplicate = query({ data: null, error: { code: "23505" } });
    const missing = query({ data: null, error: { code: "lookup_failed" } });
    expect((await setup({ queries: [duplicate, missing] }).handler(webhookRequest())).status).toBe(503);

    const mismatchClaim = query({ data: null, error: { code: "23505" } });
    const mismatch = query({ data: { processed_at: null, payload_hash: "f".repeat(64) }, error: null });
    const mismatched = setup({ queries: [mismatchClaim, mismatch] });
    expect((await mismatched.handler(webhookRequest())).status).toBe(409);
    expect(mismatched.activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.webhook_payload_mismatch" }),
      "billing webhook payload mismatch",
    );

    const failed = query({ data: null, error: { code: "database_error" } });
    const current = setup({ queries: [failed] });
    expect((await current.handler(webhookRequest())).status).toBe(503);
    expect(current.activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.webhook_claim_failed" }),
      "billing webhook claim failed",
    );
  });

  it("updates billing from checkout and marks the event processed", async () => {
    const claim = query({ data: { event_id: "evt_checkout" }, error: null });
    const billing = query({ data: { organization_id: "org-1" }, error: null });
    const processed = query({ data: { event_id: "evt_checkout" }, error: null });
    const current = setup({ queries: [claim, billing, processed] });

    const response = await current.handler(webhookRequest());
    expect(response.status).toBe(200);
    expect(billing.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      plan: "pro",
    }));
    expect(current.activeLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.webhook_processed" }),
      "billing webhook processed",
    );
  });

  it("maps price, status, and write entitlement from subscriptions", async () => {
    const claim = query({ data: { event_id: "evt_subscription" }, error: null });
    const billing = query({ data: { organization_id: "org-1" }, error: null });
    const entitlement = query({ data: { organization_id: "org-1" }, error: null });
    const processed = query({ data: { event_id: "evt_subscription" }, error: null });
    const current = setup({ event: subscriptionEvent, queries: [claim, billing, entitlement, processed] });

    expect((await current.handler(webhookRequest())).status).toBe(200);
    expect(billing.update).toHaveBeenCalledWith(expect.objectContaining({ status: "active", plan: "starter" }));
    expect(entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({
      entitlement_key: "registry.write",
      value: true,
      source: "billing",
    }), { onConflict: "organization_id,entitlement_key" });
  });

  it("handles pro and unmapped prices without trusting unknown plans", async () => {
    for (const [priceId, expectedPlan] of [["price_pro", "pro"], ["price_unknown", undefined]] as const) {
      const claim = query({ data: { event_id: "evt_subscription" }, error: null });
      const billing = query({ data: { organization_id: "org-1" }, error: null });
      const entitlement = query({ data: { organization_id: "org-1" }, error: null });
      const processed = query({ data: { event_id: "evt_subscription" }, error: null });
      const event = {
        id: `evt_${priceId}`,
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "past_due",
            metadata: { organization_id: "org-1", plan: "untrusted" },
            items: { data: [{ price: { id: priceId } }] },
          },
        },
      };
      const current = setup({ event, queries: [claim, billing, entitlement, processed] });
      expect((await current.handler(webhookRequest())).status).toBe(200);
      const patch = billing.update.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch.plan).toBe(expectedPlan);
      expect(patch).not.toHaveProperty("stripe_customer_id");
      expect(patch).not.toHaveProperty("stripe_subscription_id");
      expect(patch).not.toHaveProperty("current_period_end");
    }
  });

  it("retries an accepted but unprocessed duplicate", async () => {
    const duplicate = query({ data: null, error: { code: "23505" } });
    const existing = query({ data: { processed_at: null, payload_hash: requestPayloadHash }, error: null });
    const billing = query({ data: { organization_id: "org-1" }, error: null });
    const entitlement = query({ data: { organization_id: "org-1" }, error: null });
    const processed = query({ data: { event_id: "evt_subscription" }, error: null });
    const current = setup({
      event: subscriptionEvent,
      queries: [duplicate, existing, billing, entitlement, processed],
    });
    expect((await current.handler(webhookRequest())).status).toBe(200);
  });

  it("acknowledges irrelevant events after recording them", async () => {
    const claim = query({ data: { event_id: "evt_invoice" }, error: null });
    const processed = query({ data: { event_id: "evt_invoice" }, error: null });
    const current = setup({
      event: { id: "evt_invoice", type: "invoice.paid", data: { object: {} } },
      queries: [claim, processed],
    });
    expect((await current.handler(webhookRequest())).status).toBe(200);
    expect(current.from).toHaveBeenCalledTimes(2);
  });

  it("returns retryable errors for billing, entitlement, and completion failures", async () => {
    const makeClaim = () => query({ data: { event_id: "evt_1" }, error: null });
    const errorRecord = () => query();

    const billingFailure = setup({
      queries: [makeClaim(), query({ data: null, error: { code: "billing_failed" } }), errorRecord()],
    });
    expect((await billingFailure.handler(webhookRequest())).status).toBe(500);

    const entitlementFailure = setup({
      event: subscriptionEvent,
      queries: [
        makeClaim(),
        query({ data: { organization_id: "org-1" }, error: null }),
        query({ data: null, error: { code: "entitlement_failed" } }),
        errorRecord(),
      ],
    });
    expect((await entitlementFailure.handler(webhookRequest())).status).toBe(500);

    const completionFailure = setup({
      event: { id: "evt_invoice", type: "invoice.paid", data: { object: {} } },
      queries: [makeClaim(), query({ data: null, error: { code: "completion_failed" } }), errorRecord()],
    });
    expect((await completionFailure.handler(webhookRequest())).status).toBe(500);
    expect(completionFailure.activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.webhook_processing_failed" }),
      "billing webhook processing failed",
    );
  });
});
