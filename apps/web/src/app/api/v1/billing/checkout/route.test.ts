import { vi } from "vitest";

vi.mock("@/lib/organizations/dal", () => ({ getOptionalOrganizationAccess: vi.fn() }));
vi.mock("@/lib/billing/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ getBillingEnv: vi.fn(), getPublicEnv: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { createCheckoutHandler } from "./route";

type Query = Record<string, ReturnType<typeof vi.fn>>;

function query(result: unknown = { data: null, error: null }): Query {
  const builder: Query = {};
  for (const method of ["insert", "update", "select", "eq"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

function request(
  body: unknown = { organizationSlug: "northstar", plan: "starter" },
  key = "checkout_request_12345",
): Request {
  return new Request("https://app.example.test/api/v1/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function setup({
  role = "owner",
  adminQueries = [],
  billingResult = { data: { stripe_customer_id: "cus_existing" }, error: null },
}: {
  role?: "owner" | "admin" | "member" | "viewer";
  adminQueries?: Query[];
  billingResult?: unknown;
} = {}) {
  const billingQuery = query(billingResult);
  const access = vi.fn().mockResolvedValue({
    id: "10000000-0000-4000-8000-000000000001",
    slug: "northstar",
    role,
    supabase: { from: vi.fn(() => billingQuery) },
  });
  const from = vi.fn();
  adminQueries.forEach((builder) => from.mockReturnValueOnce(builder));
  const admin = vi.fn(() => ({ from }));
  const customersCreate = vi.fn().mockResolvedValue({ id: "cus_created" });
  const sessionsCreate = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  const stripe = vi.fn(() => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
  }));
  const activeLogger = { info: vi.fn(), error: vi.fn() };
  const handler = createCheckoutHandler({
    access: access as never,
    admin: admin as never,
    stripe: stripe as never,
    billingEnv: (() => ({
      STRIPE_PRICE_STARTER: "price_starter",
      STRIPE_PRICE_PRO: "price_pro",
    })) as never,
    publicEnv: (() => ({ NEXT_PUBLIC_APP_URL: "https://app.example.test" })) as never,
    requestId: (() => "request-1") as never,
    activeLogger: activeLogger as never,
  });
  return { handler, access, from, customersCreate, sessionsCreate, activeLogger, billingQuery };
}

describe("billing checkout API", () => {
  it("requires idempotency before parsing", async () => {
    const { handler, access } = setup();
    const response = await handler(request({}, "short"));
    expect(response.status).toBe(400);
    expect(access).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies", async () => {
    const { handler } = setup();
    expect((await handler(request("not-json"))).status).toBe(400);
    expect((await handler(request({ organizationSlug: "x", plan: "invalid" }))).status).toBe(400);
  });

  it("separates unauthenticated and unauthorized callers", async () => {
    const unauthenticated = setup();
    unauthenticated.access.mockResolvedValue(null);
    expect((await unauthenticated.handler(request())).status).toBe(401);

    const member = setup({ role: "member" });
    expect((await member.handler(request())).status).toBe(403);
  });

  it("returns a temporary failure when the idempotency claim fails", async () => {
    const claim = query({ data: null, error: { code: "database_error" } });
    const { handler, activeLogger } = setup({ adminQueries: [claim] });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.checkout_claim_failed" }),
      "checkout claim failed",
    );
  });

  it("enforces exact replay semantics", async () => {
    const claim = query({ data: null, error: { code: "23505" } });
    const mismatch = query({
      data: { request_hash: "different", response_status: null, response_body: null },
      error: null,
    });
    const mismatchSetup = setup({ adminQueries: [claim, mismatch] });
    expect((await mismatchSetup.handler(request())).status).toBe(409);

    const duplicateClaim = query({ data: null, error: { code: "23505" } });
    const payload = JSON.stringify({ organizationSlug: "northstar", plan: "starter" });
    const { hashRequestPayload } = await import("@/lib/server/idempotency");
    const cached = query({
      data: {
        request_hash: hashRequestPayload(payload),
        response_status: 201,
        response_body: { url: "https://cached.test" },
      },
      error: null,
    });
    const cachedSetup = setup({ adminQueries: [duplicateClaim, cached] });
    const cachedResponse = await cachedSetup.handler(request(JSON.parse(payload)));
    expect(cachedResponse.status).toBe(201);
    await expect(cachedResponse.json()).resolves.toEqual({ url: "https://cached.test" });

    const progressClaim = query({ data: null, error: { code: "23505" } });
    const inProgress = query({
      data: { request_hash: hashRequestPayload(payload), response_status: null, response_body: null },
      error: null,
    });
    const progressSetup = setup({ adminQueries: [progressClaim, inProgress] });
    expect((await progressSetup.handler(request(JSON.parse(payload)))).status).toBe(409);

    const missingClaim = query({ data: null, error: { code: "23505" } });
    const missingReplay = query({ data: null, error: { code: "lookup_failed" } });
    const missingSetup = setup({ adminQueries: [missingClaim, missingReplay] });
    expect((await missingSetup.handler(request())).status).toBe(503);
  });

  it("creates checkout for an existing customer and stores replay output", async () => {
    const claim = query({ data: { idempotency_key: "key" }, error: null });
    const completion = query({ data: { idempotency_key: "key" }, error: null });
    const { handler, sessionsCreate, customersCreate, activeLogger } = setup({
      role: "admin",
      adminQueries: [claim, completion],
    });

    const response = await handler(request({ organizationSlug: "northstar", plan: "pro" }));
    expect(response.status).toBe(201);
    expect(customersCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        line_items: [{ price: "price_pro", quantity: 1 }],
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("checkout:") }),
    );
    expect(activeLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.checkout_created", plan: "pro" }),
      "checkout created",
    );
  });

  it("creates and saves a missing Stripe customer", async () => {
    const claim = query({ data: { idempotency_key: "key" }, error: null });
    const customerSave = query({ data: { organization_id: "org" }, error: null });
    const completion = query({ data: { idempotency_key: "key" }, error: null });
    const { handler, customersCreate, sessionsCreate } = setup({
      adminQueries: [claim, customerSave, completion],
      billingResult: { data: { stripe_customer_id: null }, error: null },
    });

    expect((await handler(request())).status).toBe(201);
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.any(Object) }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("customer:") }),
    );
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_created" }),
      expect.any(Object),
    );
  });

  it("normalizes provider failures to a correlated 502", async () => {
    const claim = query({ data: { idempotency_key: "key" }, error: null });
    const { handler, activeLogger } = setup({
      adminQueries: [claim],
      billingResult: { data: null, error: { code: "lookup_failed" } },
    });

    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "billing.checkout_failed", errorCode: "billing_lookup" }),
      "checkout failed",
    );
  });

  it("fails closed when customer persistence fails", async () => {
    const claim = query({ data: { idempotency_key: "key" }, error: null });
    const customerSave = query({ data: null, error: { code: "write_failed" } });
    const { handler } = setup({
      adminQueries: [claim, customerSave],
      billingResult: { data: { stripe_customer_id: null }, error: null },
    });
    expect((await handler(request())).status).toBe(502);
  });

  it("fails closed when Stripe omits a URL", async () => {
    const claim = query({ data: { idempotency_key: "key" }, error: null });
    const current = setup({ adminQueries: [claim] });
    current.sessionsCreate.mockResolvedValue({ url: null });
    expect((await current.handler(request())).status).toBe(502);
  });

  it("fails closed when replay output cannot be persisted", async () => {
    const claim = query({ data: { idempotency_key: "key" }, error: null });
    const completion = query({ data: null, error: { code: "write_failed" } });
    const current = setup({ adminQueries: [claim, completion] });
    expect((await current.handler(request())).status).toBe(502);
  });
});
