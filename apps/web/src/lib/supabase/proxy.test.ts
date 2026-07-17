import { NextRequest } from "next/server";
import { vi } from "vitest";

type CookieOptions = {
  cookies: {
    getAll: () => unknown;
    setAll: (values: Array<{ name: string; value: string; options: Record<string, unknown> }>) => void;
  };
};

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn() }));

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key-12345",
  }),
}));

import { updateSession } from "./proxy";

describe("session Proxy", () => {
  it("refreshes claims and forwards response cookies", async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options: CookieOptions) => {
      options.cookies.getAll();
      return {
        auth: {
          getClaims: vi.fn(async () => {
            options.cookies.setAll([
              { name: "session", value: "refreshed", options: { httpOnly: true } },
            ]);
            return { data: { claims: { sub: "user-1" } }, error: null };
          }),
        },
      };
    });

    const response = await updateSession(new NextRequest("https://app.example.test/dashboard"));

    expect(response.cookies.get("session")?.value).toBe("refreshed");
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-test-key-12345",
      expect.any(Object),
    );
  });
});
