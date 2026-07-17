import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/organizations/dal", () => ({ getOrganizationAccess: mocks.access }));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: mocks.info, warn: mocks.warn, error: mocks.error },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { initialApiKeyState } from "@/lib/api/state";
import { createApiKey, revokeApiKey } from "./api-keys";

type Query = Record<string, ReturnType<typeof vi.fn>>;

function query(result: unknown): Query {
  const builder: Query = {};
  for (const method of ["insert", "update", "select", "eq", "is"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    organizationSlug: "northstar",
    name: "Production integration",
    keyId: "10000000-0000-4000-8000-000000000001",
    ...overrides,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

function access(role: "owner" | "admin" | "member", builders: Query[]) {
  const from = vi.fn();
  builders.forEach((builder) => from.mockReturnValueOnce(builder));
  mocks.access.mockResolvedValue({
    id: "org-1",
    role,
    userId: "user-1",
    supabase: { from },
  });
  return from;
}

beforeEach(() => vi.clearAllMocks());

describe("API key actions", () => {
  it("validates input before authorization", async () => {
    await expect(createApiKey(initialApiKeyState, form({ name: "x" }))).resolves.toMatchObject({
      status: "error",
    });
    await expect(revokeApiKey(initialApiKeyState, form({ keyId: "bad" }))).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("limits lifecycle management to organization administrators", async () => {
    access("member", []);
    await expect(createApiKey(initialApiKeyState, form())).resolves.toMatchObject({
      message: /administrator/i,
    });
    access("member", []);
    await expect(revokeApiKey(initialApiKeyState, form())).resolves.toMatchObject({
      message: /administrator/i,
    });
  });

  it("returns a new secret exactly once while storing only its hash", async () => {
    const builder = query({ data: { id: "key-1" }, error: null });
    access("owner", [builder]);
    const state = await createApiKey(initialApiKeyState, form());
    expect(state).toMatchObject({ status: "created", key: expect.stringMatching(/^pp_live_/) });
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      key_prefix: expect.stringMatching(/^pp_live_/),
      key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      scopes: ["dogs:read"],
    }));
    expect(JSON.stringify(builder.insert.mock.calls)).not.toContain(state.key);
  });

  it("returns safe creation failures", async () => {
    const builder = query({ data: null, error: { code: "database_error" } });
    access("admin", [builder]);
    await expect(createApiKey(initialApiKeyState, form())).resolves.toEqual({
      status: "error",
      message: "API key could not be created.",
    });
  });

  it("revokes only active keys in the current tenant", async () => {
    const builder = query({ data: { id: "key-1" }, error: null });
    access("admin", [builder]);
    await expect(revokeApiKey(initialApiKeyState, form())).resolves.toEqual({
      status: "saved",
      message: "API key revoked.",
    });
    expect(builder.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(builder.is).toHaveBeenCalledWith("revoked_at", null);
  });

  it("returns safe revocation failures", async () => {
    const builder = query({ data: null, error: null });
    access("owner", [builder]);
    await expect(revokeApiKey(initialApiKeyState, form())).resolves.toMatchObject({ status: "error" });
  });
});
