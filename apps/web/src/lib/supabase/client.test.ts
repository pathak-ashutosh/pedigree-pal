import { vi } from "vitest";

const mocks = vi.hoisted(() => ({ browserClient: { kind: "browser" }, createBrowserClient: vi.fn() }));

mocks.createBrowserClient.mockReturnValue(mocks.browserClient);
vi.mock("@supabase/ssr", () => ({ createBrowserClient: mocks.createBrowserClient }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key-12345",
  }),
}));

import { createClient } from "./client";

describe("browser Supabase client", () => {
  it("creates one reusable client with validated configuration", () => {
    expect(createClient()).toBe(mocks.browserClient);
    expect(createClient()).toBe(mocks.browserClient);
    expect(mocks.createBrowserClient).toHaveBeenCalledOnce();
    expect(mocks.createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-test-key-12345",
    );
  });
});
