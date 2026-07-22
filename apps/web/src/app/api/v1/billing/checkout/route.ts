import { z } from "zod";
import { can } from "@/domain/rbac";
import { getBillingEnv, getPublicEnv } from "@/lib/env";
import { getOptionalOrganizationAccess } from "@/lib/organizations/dal";
import { getStripe } from "@/lib/billing/stripe";
import { hashRequestPayload, parseIdempotencyKey } from "@/lib/server/idempotency";
import { logger } from "@/lib/server/logger";
import { hasTrustedOrigin } from "@/lib/server/origin";
import {
  getRequestId,
  hasJsonContentType,
  readLimitedRequestText,
  RequestBodyTooLargeError,
} from "@/lib/server/request";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  organizationSlug: z.string().min(2).max(63),
  plan: z.enum(["starter", "pro"]),
});

const defaultDependencies = {
  access: getOptionalOrganizationAccess,
  admin: createAdminClient,
  stripe: getStripe,
  billingEnv: getBillingEnv,
  publicEnv: getPublicEnv,
  requestId: getRequestId,
  activeLogger: logger,
};

function json(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

export function createCheckoutHandler(
  overrides: Partial<typeof defaultDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    const requestId = dependencies.requestId(request);
    const publicEnv = dependencies.publicEnv();
    if (!hasTrustedOrigin(request, publicEnv.NEXT_PUBLIC_APP_URL)) {
      return json({ error: "Request origin is not allowed." }, 403, requestId);
    }
    if (!hasJsonContentType(request)) {
      return json({ error: "Content-Type must be application/json." }, 415, requestId);
    }
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    if (!idempotencyKey) {
      return json({ error: "A valid Idempotency-Key header is required." }, 400, requestId);
    }

    let rawBody: string;
    try {
      rawBody = await readLimitedRequestText(request, 8 * 1024);
    } catch (error) {
      return error instanceof RequestBodyTooLargeError
        ? json({ error: "Checkout request is too large." }, 413, requestId)
        : json({ error: "Invalid checkout request." }, 400, requestId);
    }
    let input;
    try {
      input = checkoutSchema.parse(JSON.parse(rawBody));
    } catch {
      return json({ error: "Invalid checkout request." }, 400, requestId);
    }

    const access = await dependencies.access(input.organizationSlug);
    if (!access) {
      return json({ error: "Authentication required." }, 401, requestId);
    }
    if (!can(access.role, "organization:manage")) {
      return json({ error: "Organization administrator access required." }, 403, requestId);
    }

    const admin = dependencies.admin();
    const requestHash = hashRequestPayload(rawBody);
    const { error: claimError } = await admin
      .from("idempotency_keys")
      .insert({
        organization_id: access.id,
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
      })
      .select("idempotency_key")
      .maybeSingle();

    if (claimError?.code === "23505") {
      const { data: existing, error: existingError } = await admin
        .from("idempotency_keys")
        .select("request_hash, response_status, response_body")
        .eq("organization_id", access.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingError || !existing) {
        return json({ error: "Checkout state is temporarily unavailable." }, 503, requestId);
      }
      const replay = existing as {
        request_hash: string;
        response_status: number | null;
        response_body: unknown;
      };
      if (replay.request_hash !== requestHash) {
        return json({ error: "Idempotency key was reused with a different request." }, 409, requestId);
      }
      if (replay.response_status && replay.response_body) {
        return json(replay.response_body, replay.response_status, requestId);
      }
      return json({ error: "A checkout with this key is already in progress." }, 409, requestId);
    }
    if (claimError) {
      dependencies.activeLogger.error(
        { event: "billing.checkout_claim_failed", errorCode: claimError.code, requestId },
        "checkout claim failed",
      );
      return json({ error: "Checkout is temporarily unavailable." }, 503, requestId);
    }

    try {
      const billing = await access.supabase
        .from("organization_billing")
        .select("stripe_customer_id")
        .eq("organization_id", access.id)
        .maybeSingle();
      if (billing.error || !billing.data) {
        throw new Error(`billing_lookup:${billing.error?.code ?? "not_found"}`);
      }

      const stripe = dependencies.stripe();
      let customerId = billing.data.stripe_customer_id as string | null;
      if (!customerId) {
        const customer = await stripe.customers.create(
          { metadata: { organization_id: access.id } },
          { idempotencyKey: `customer:${access.id}` },
        );
        customerId = customer.id;
        const customerUpdate = await admin
          .from("organization_billing")
          .update({ stripe_customer_id: customerId })
          .eq("organization_id", access.id)
          .select("organization_id")
          .maybeSingle();
        if (customerUpdate.error || !customerUpdate.data) {
          throw new Error(`customer_save:${customerUpdate.error?.code ?? "not_found"}`);
        }
      }

      const billingEnv = dependencies.billingEnv();
      const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
      const price = input.plan === "starter"
        ? billingEnv.STRIPE_PRICE_STARTER
        : billingEnv.STRIPE_PRICE_PRO;
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          client_reference_id: access.id,
          line_items: [{ price, quantity: 1 }],
          metadata: { organization_id: access.id, plan: input.plan },
          subscription_data: { metadata: { organization_id: access.id, plan: input.plan } },
          success_url: `${appUrl}/dashboard/${access.slug}?billing=success`,
          cancel_url: `${appUrl}/dashboard/${access.slug}?billing=canceled`,
        },
        { idempotencyKey: `checkout:${access.id}:${idempotencyKey}` },
      );
      if (!session.url) {
        throw new Error("checkout_url:missing");
      }

      const responseBody = { url: session.url };
      const completion = await admin
        .from("idempotency_keys")
        .update({ response_status: 201, response_body: responseBody })
        .eq("organization_id", access.id)
        .eq("idempotency_key", idempotencyKey)
        .select("idempotency_key")
        .maybeSingle();
      if (completion.error || !completion.data) {
        throw new Error(`checkout_save:${completion.error?.code ?? "not_found"}`);
      }

      dependencies.activeLogger.info(
        { event: "billing.checkout_created", requestId, plan: input.plan },
        "checkout created",
      );
      return json(responseBody, 201, requestId);
    } catch (error) {
      dependencies.activeLogger.error(
        {
          event: "billing.checkout_failed",
          requestId,
          errorCode: error instanceof Error ? error.message.split(":", 1)[0] : "unknown",
        },
        "checkout failed",
      );
      return json({ error: "Checkout is temporarily unavailable." }, 502, requestId);
    }
  };
}

export const POST = createCheckoutHandler();
