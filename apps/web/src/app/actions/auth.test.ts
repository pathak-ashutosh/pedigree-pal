import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  requestHeaders: { value: new Headers() },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: mocks.info, warn: mocks.warn },
}));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key-12345",
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: async () => mocks.requestHeaders.value }));

import { initialAuthState } from "@/lib/auth/state";
import { requestMagicLink, signOut } from "./auth";

function authForm(email: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestHeaders.value = new Headers();
});

describe("auth actions", () => {
  it("rejects invalid email before calling the provider", async () => {
    await expect(requestMagicLink(initialAuthState, authForm("bad-email"))).resolves.toMatchObject({
      status: "error",
      errors: { email: expect.any(Array) },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns a safe provider failure and logs only its code", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: { code: "rate_limited" } });
    mocks.createClient.mockResolvedValue({ auth: { signInWithOtp } });

    await expect(
      requestMagicLink(initialAuthState, authForm("person@example.test")),
    ).resolves.toEqual({
      status: "error",
      message: "We could not send the sign-in link. Try again shortly.",
    });
    expect(mocks.warn).toHaveBeenCalledWith(
      { event: "auth.magic_link.failed", errorCode: "rate_limited" },
      "magic link failed",
    );
  });

  it("requests a PKCE callback and confirms delivery", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { signInWithOtp } });

    await expect(
      requestMagicLink(initialAuthState, authForm("person@example.test")),
    ).resolves.toEqual({
      status: "sent",
      message: "Check your inbox for a secure sign-in link.",
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.test",
      options: {
        emailRedirectTo: "https://app.example.test/auth/callback?next=/dashboard",
        shouldCreateUser: true,
      },
    });
    expect(mocks.info).toHaveBeenCalledWith({ event: "auth.magic_link.sent" }, "magic link sent");
  });

  it("ignores spoofed forwarded origins", async () => {
    mocks.requestHeaders.value = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "pedigree-pal.vercel.app",
    });
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { signInWithOtp } });

    await requestMagicLink(initialAuthState, authForm("person@example.test"));
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://app.example.test/auth/callback?next=/dashboard",
        }),
      }),
    );
  });

  it("clears the provider session before redirecting", async () => {
    const providerSignOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { signOut: providerSignOut } });

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");
    expect(providerSignOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
