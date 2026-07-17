import { vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createDogsApiHandler } from "./route";

type Query = Record<string, ReturnType<typeof vi.fn>>;

function query(result: { data: unknown; error: null | { code: string } }): Query {
  const builder: Query = {};
  for (const method of ["select", "eq", "neq", "order", "limit", "ilike", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
  return builder;
}

const validKey = "pp_live_" + "a".repeat(48);
const credential = {
  data: {
    id: "key-1",
    organization_id: "org-1",
    scopes: ["dogs:read"],
    revoked_at: null,
  },
  error: null,
};

function apiRequest(queryString = "", authorization = `Bearer ${validKey}`) {
  return new Request(`https://app.example.test/api/v1/dogs${queryString}`, {
    headers: authorization ? { authorization } : {},
  });
}

function setup({
  queries = [],
  quota = { data: true, error: null },
}: {
  queries?: Query[];
  quota?: { data: unknown; error: null | { code: string } };
} = {}) {
  const from = vi.fn();
  queries.forEach((builder) => from.mockReturnValueOnce(builder));
  const rpc = vi.fn().mockResolvedValue(quota);
  const activeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const handler = createDogsApiHandler({
    admin: (() => ({ from, rpc })) as never,
    requestId: (() => "request-1") as never,
    activeLogger: activeLogger as never,
  });
  return { handler, from, rpc, activeLogger };
}

describe("versioned dogs API", () => {
  it("requires a syntactically valid bearer credential", async () => {
    const current = setup();
    expect((await current.handler(apiRequest("", ""))).status).toBe(401);
    expect((await current.handler(apiRequest("", "Bearer invalid"))).status).toBe(401);
    expect(current.from).not.toHaveBeenCalled();
  });

  it("fails safely when credential storage is unavailable", async () => {
    const auth = query({ data: null, error: { code: "database_error" } });
    const current = setup({ queries: [auth] });
    expect((await current.handler(apiRequest())).status).toBe(503);
    expect(current.activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "api.authentication_failed" }),
      "API authentication failed",
    );
  });

  it("rejects missing, revoked, and underscoped credentials", async () => {
    const missing = setup({ queries: [query({ data: null, error: null })] });
    expect((await missing.handler(apiRequest())).status).toBe(401);

    const revoked = setup({ queries: [query({
      data: { ...credential.data, revoked_at: "2026-07-15T00:00:00Z" },
      error: null,
    })] });
    expect((await revoked.handler(apiRequest())).status).toBe(401);

    const scoped = setup({ queries: [query({
      data: { ...credential.data, scopes: ["billing:read"] },
      error: null,
    })] });
    expect((await scoped.handler(apiRequest())).status).toBe(403);

    const malformedScopes = setup({ queries: [query({
      data: { ...credential.data, scopes: "dogs:read" },
      error: null,
    })] });
    expect((await malformedScopes.handler(apiRequest())).status).toBe(403);
  });

  it("validates search and bounded result limits before quota use", async () => {
    const current = setup({ queries: [query(credential)] });
    expect((await current.handler(apiRequest("?limit=101"))).status).toBe(400);
    expect(current.rpc).not.toHaveBeenCalled();
  });

  it("enforces an atomic quota and exposes retry guidance", async () => {
    const failed = setup({
      queries: [query(credential)],
      quota: { data: null, error: { code: "quota_error" } },
    });
    expect((await failed.handler(apiRequest())).status).toBe(503);

    const denied = setup({ queries: [query(credential)], quota: { data: false, error: null } });
    const response = await denied.handler(apiRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("returns safe provider failures", async () => {
    const auth = query(credential);
    const dogs = query({ data: null, error: { code: "query_failed" } });
    const current = setup({ queries: [auth, dogs] });
    expect((await current.handler(apiRequest())).status).toBe(503);
    expect(current.activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "api.dogs_list_failed" }),
      "API dog query failed",
    );
  });

  it("returns tenant records, bounded search, and usage metadata", async () => {
    const auth = query(credential);
    const dogs = query({ data: [{ id: "dog-1", registered_name: "Juniper" }], error: null });
    const lastUsed = query({ data: { id: "key-1" }, error: null });
    const current = setup({ queries: [auth, dogs, lastUsed] });
    const response = await current.handler(apiRequest("?search=June&limit=10"));

    expect(response.status).toBe(200);
    expect(dogs.limit).toHaveBeenCalledWith(10);
    expect(dogs.ilike).toHaveBeenCalledWith("registered_name", "%June%");
    expect(current.rpc).toHaveBeenCalledWith("consume_api_request", {
      target_organization_id: "org-1",
      max_requests: 120,
    });
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "dog-1" }],
      meta: { count: 1, requestId: "request-1" },
    });
  });

  it("does not fail reads when last-used telemetry cannot persist", async () => {
    const auth = query(credential);
    const dogs = query({ data: [], error: null });
    const lastUsed = query({ data: null, error: { code: "write_failed" } });
    const current = setup({ queries: [auth, dogs, lastUsed] });
    expect((await current.handler(apiRequest())).status).toBe(200);
    expect(current.activeLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "api.key_usage_update_failed" }),
      "API key usage timestamp failed",
    );
  });
});
