import { canonicalOrigin, hasCanonicalHost, hasTrustedOrigin, originFromHeaders } from "./origin";

const fallback = "https://fallback.example.test";

describe("originFromHeaders", () => {
  it("ignores untrusted forwarded headers", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "attacker.example.test",
    });
    expect(originFromHeaders(headers, fallback)).toBe(fallback);
  });

  it("normalizes the configured origin", () => {
    expect(originFromHeaders(new Headers(), `${fallback}/some/path?ignored=true`)).toBe(fallback);
    expect(() => canonicalOrigin("ftp://fallback.example.test")).toThrow(/HTTP or HTTPS/);
  });
});

describe("request origin validation", () => {
  it("accepts only the configured host", () => {
    expect(hasCanonicalHost(new Headers({ host: "fallback.example.test" }), fallback)).toBe(true);
    expect(hasCanonicalHost(new Headers({
      host: "fallback.example.test",
      "x-forwarded-host": "fallback.example.test",
    }), fallback)).toBe(true);
    expect(hasCanonicalHost(new Headers({ host: "attacker.example.test" }), fallback)).toBe(false);
    expect(hasCanonicalHost(new Headers({
      host: "attacker.example.test",
      "x-forwarded-host": "fallback.example.test",
    }), fallback)).toBe(false);
    expect(hasCanonicalHost(new Headers({
      host: "fallback.example.test",
      "x-forwarded-host": "fallback.example.test, attacker.example.test",
    }), fallback)).toBe(false);
    expect(hasCanonicalHost(new Headers(), fallback)).toBe(false);
    expect(hasCanonicalHost(new Headers({ host: "user@fallback.example.test" }), fallback)).toBe(false);
  });

  it("requires an exact Origin match", () => {
    const trusted = new Request(`${fallback}/checkout`, { headers: { origin: fallback } });
    const untrusted = new Request(`${fallback}/checkout`, {
      headers: { origin: "https://attacker.example.test" },
    });
    expect(hasTrustedOrigin(trusted, fallback)).toBe(true);
    expect(hasTrustedOrigin(untrusted, fallback)).toBe(false);
    expect(hasTrustedOrigin(new Request(`${fallback}/checkout`), fallback)).toBe(false);
    expect(hasTrustedOrigin(new Request(`${fallback}/checkout`, {
      headers: { origin: "not a URL" },
    }), fallback)).toBe(false);
  });
});
