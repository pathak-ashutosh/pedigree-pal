import { afterEach, vi } from "vitest";
import {
  getAdminEnv,
  getBillingEnv,
  getPublicEnv,
  getServerEnv,
  parseAdminEnv,
  parseBillingEnv,
  parsePublicEnv,
  parseServerEnv,
} from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("environment validation", () => {
  it("parses public configuration", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key-12345",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key-12345",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
  });

  it("rejects missing or malformed public configuration", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow();
  });

  it("uses safe server defaults and validates log levels", () => {
    expect(parseServerEnv({})).toEqual({ LOG_LEVEL: "info", RELEASE_SHA: "development" });
    expect(() => parseServerEnv({ LOG_LEVEL: "verbose" })).toThrow();
  });

  it("reads validated runtime configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://runtime.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-runtime-key-12345");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("RELEASE_SHA", "release-123");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key-12345");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");

    expect(getPublicEnv().NEXT_PUBLIC_APP_URL).toBe("https://app.example.test");
    expect(getServerEnv()).toEqual({ LOG_LEVEL: "debug", RELEASE_SHA: "release-123" });
    expect(getAdminEnv().SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-test-key-12345");
    expect(getBillingEnv().STRIPE_PRICE_PRO).toBe("price_pro");
  });

  it("validates privileged provider configuration", () => {
    expect(() => parseAdminEnv({ SUPABASE_SERVICE_ROLE_KEY: "short" })).toThrow();
    expect(() =>
      parseBillingEnv({
        STRIPE_SECRET_KEY: "bad",
        STRIPE_WEBHOOK_SECRET: "bad",
        STRIPE_PRICE_STARTER: "bad",
        STRIPE_PRICE_PRO: "bad",
      }),
    ).toThrow();
  });
});
