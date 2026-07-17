import { vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ adminClient: { kind: "admin" }, createClient: vi.fn() }));

mocks.createClient.mockReturnValue(mocks.adminClient);
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
  getAdminEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-12345" }),
}));

import { createAdminClient } from "./admin";

describe("admin Supabase client", () => {
  it("creates one server-only non-persistent client", () => {
    expect(createAdminClient()).toBe(mocks.adminClient);
    expect(createAdminClient()).toBe(mocks.adminClient);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-test-key-12345",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });
});
