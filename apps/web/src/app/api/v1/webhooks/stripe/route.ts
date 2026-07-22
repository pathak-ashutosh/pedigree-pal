import type Stripe from "stripe";
import { getBillingEnv } from "@/lib/env";
import { parseStripeBillingEvent } from "@/lib/billing/events";
import { getStripe } from "@/lib/billing/stripe";
import { hashRequestPayload } from "@/lib/server/idempotency";
import { logger } from "@/lib/server/logger";
import {
  getRequestId,
  hasJsonContentType,
  readLimitedRequestText,
  RequestBodyTooLargeError,
} from "@/lib/server/request";
import { createAdminClient } from "@/lib/supabase/admin";

const defaultDependencies = {
  admin: createAdminClient,
  stripe: getStripe,
  billingEnv: getBillingEnv,
  requestId: getRequestId,
  activeLogger: logger,
};

function json(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

function planForPrice(priceId: string | undefined, plan: string | undefined, env: ReturnType<typeof getBillingEnv>) {
  if (plan === "starter" || plan === "pro") {
    return plan;
  }
  if (priceId === env.STRIPE_PRICE_STARTER) {
    return "starter";
  }
  if (priceId === env.STRIPE_PRICE_PRO) {
    return "pro";
  }
  return undefined;
}

export function createStripeWebhookHandler(
  overrides: Partial<typeof defaultDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    const requestId = dependencies.requestId(request);
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return json({ error: "Stripe signature required." }, 400, requestId);
    }
    if (!hasJsonContentType(request)) {
      return json({ error: "Content-Type must be application/json." }, 415, requestId);
    }

    let rawBody: string;
    try {
      rawBody = await readLimitedRequestText(request, 256 * 1024);
    } catch (error) {
      return error instanceof RequestBodyTooLargeError
        ? json({ error: "Webhook payload is too large." }, 413, requestId)
        : json({ error: "Webhook payload is invalid." }, 400, requestId);
    }
    let event: Stripe.Event;
    try {
      event = dependencies.stripe().webhooks.constructEvent(
        rawBody,
        signature,
        dependencies.billingEnv().STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      dependencies.activeLogger.warn(
        { event: "billing.webhook_signature_invalid", requestId },
        "billing webhook rejected",
      );
      return json({ error: "Invalid Stripe signature." }, 400, requestId);
    }

    const admin = dependencies.admin();
    const payloadHash = hashRequestPayload(rawBody);
    const claim = await admin
      .from("billing_webhook_events")
      .insert({
        provider: "stripe",
        event_id: event.id,
        event_type: event.type,
        payload_hash: payloadHash,
      })
      .select("event_id")
      .maybeSingle();

    if (claim.error?.code === "23505") {
      const existing = await admin
        .from("billing_webhook_events")
        .select("processed_at, payload_hash")
        .eq("provider", "stripe")
        .eq("event_id", event.id)
        .maybeSingle();
      if (existing.error || !existing.data) {
        return json({ error: "Webhook state is temporarily unavailable." }, 503, requestId);
      }
      if (existing.data.payload_hash !== payloadHash) {
        dependencies.activeLogger.error(
          { event: "billing.webhook_payload_mismatch", eventType: event.type, requestId },
          "billing webhook payload mismatch",
        );
        return json({ error: "Webhook event payload mismatch." }, 409, requestId);
      }
      if (existing.data.processed_at) {
        return json({ received: true, duplicate: true }, 200, requestId);
      }
    } else if (claim.error) {
      dependencies.activeLogger.error(
        { event: "billing.webhook_claim_failed", errorCode: claim.error.code, requestId },
        "billing webhook claim failed",
      );
      return json({ error: "Webhook is temporarily unavailable." }, 503, requestId);
    }

    try {
      const mutation = parseStripeBillingEvent(event);
      if (mutation) {
        const env = dependencies.billingEnv();
        const plan = planForPrice(mutation.priceId, mutation.plan, env);
        const billingPatch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (mutation.customerId) billingPatch.stripe_customer_id = mutation.customerId;
        if (mutation.subscriptionId) billingPatch.stripe_subscription_id = mutation.subscriptionId;
        if (mutation.status) billingPatch.status = mutation.status;
        if (mutation.currentPeriodEnd) billingPatch.current_period_end = mutation.currentPeriodEnd;
        if (mutation.priceId) billingPatch.stripe_price_id = mutation.priceId;
        if (plan) billingPatch.plan = plan;

        const billingUpdate = await admin
          .from("organization_billing")
          .update(billingPatch)
          .eq("organization_id", mutation.organizationId)
          .select("organization_id")
          .maybeSingle();
        if (billingUpdate.error || !billingUpdate.data) {
          throw new Error(`billing_update:${billingUpdate.error?.code ?? "not_found"}`);
        }

        if (mutation.registryWriteEnabled !== undefined) {
          const entitlement = await admin
            .from("organization_entitlements")
            .upsert({
              organization_id: mutation.organizationId,
              entitlement_key: "registry.write",
              value: mutation.registryWriteEnabled,
              source: "billing",
              updated_at: new Date().toISOString(),
            }, { onConflict: "organization_id,entitlement_key" })
            .select("organization_id")
            .maybeSingle();
          if (entitlement.error || !entitlement.data) {
            throw new Error(`entitlement_update:${entitlement.error?.code ?? "not_found"}`);
          }
        }
      }

      const processed = await admin
        .from("billing_webhook_events")
        .update({ processed_at: new Date().toISOString(), error_code: null })
        .eq("provider", "stripe")
        .eq("event_id", event.id)
        .select("event_id")
        .maybeSingle();
      if (processed.error || !processed.data) {
        throw new Error(`webhook_complete:${processed.error?.code ?? "not_found"}`);
      }

      dependencies.activeLogger.info(
        { event: "billing.webhook_processed", eventType: event.type, requestId },
        "billing webhook processed",
      );
      return json({ received: true }, 200, requestId);
    } catch (error) {
      const errorCode = error instanceof Error ? error.message.split(":", 1)[0] : "unknown";
      await admin
        .from("billing_webhook_events")
        .update({ error_code: errorCode })
        .eq("provider", "stripe")
        .eq("event_id", event.id);
      dependencies.activeLogger.error(
        { event: "billing.webhook_processing_failed", errorCode, eventType: event.type, requestId },
        "billing webhook processing failed",
      );
      return json({ error: "Webhook processing failed." }, 500, requestId);
    }
  };
}

export const POST = createStripeWebhookHandler();
