import { beforeEach, vi } from "vitest";

type CookieOptions = {
  cookies: {
    getAll: () => unknown;
    setAll: (values: Array<{ name: string; value: string; options: Record<string, unknown> }>) => void;
  };
};

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookies: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key-12345",
  }),
}));

import { createClient } from "./server";

let options: CookieOptions;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: mocks.getAll, set: mocks.set });
  mocks.createServerClient.mockImplementation((_url, _key, captured: CookieOptions) => {
    options = captured;
    return { kind: "server" };
  });
});

describe("server Supabase client", () => {
  it("adapts request cookies in both directions", async () => {
    mocks.getAll.mockReturnValue([{ name: "session", value: "old" }]);
    await expect(createClient()).resolves.toEqual({ kind: "server" });

    expect(options.cookies.getAll()).toEqual([{ name: "session", value: "old" }]);
    options.cookies.setAll([{ name: "session", value: "new", options: { httpOnly: true } }]);
    expect(mocks.set).toHaveBeenCalledWith("session", "new", { httpOnly: true });
  });

  it("tolerates cookie writes from read-only Server Components", async () => {
    mocks.set.mockImplementation(() => {
      throw new Error("read-only");
    });
    await createClient();

    expect(() =>
      options.cookies.setAll([{ name: "session", value: "new", options: {} }]),
    ).not.toThrow();
  });
});
