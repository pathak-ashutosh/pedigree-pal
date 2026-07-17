import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: mocks.info, warn: mocks.warn },
}));

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("auth callback", () => {
  it("exchanges a valid code and keeps internal redirects", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { exchangeCodeForSession } });

    const response = await GET(
      new Request("https://app.example.test/auth/callback?code=abc&next=/dashboard/dogs"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://app.example.test/dashboard/dogs");
    expect(mocks.info).toHaveBeenCalledWith(
      { event: "auth.callback.succeeded" },
      "auth callback succeeded",
    );
  });

  it("returns provider failures to a generic login error", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { code: "expired" } }) },
    });

    const response = await GET(new Request("https://app.example.test/auth/callback?code=expired"));

    expect(response.headers.get("location")).toBe("https://app.example.test/login?error=auth");
    expect(mocks.warn).toHaveBeenCalledWith(
      { event: "auth.callback.failed", errorCode: "expired" },
      "auth callback failed",
    );
  });

  it("rejects callbacks without a code", async () => {
    const response = await GET(new Request("https://app.example.test/auth/callback"));

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.example.test/login?error=auth");
    expect(mocks.warn).toHaveBeenCalledWith(
      { event: "auth.callback.missing_code" },
      "auth callback missing code",
    );
  });
});
