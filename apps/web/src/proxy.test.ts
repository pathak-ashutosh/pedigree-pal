import { buildContentSecurityPolicy } from "./proxy";

describe("browser security policy", () => {
  it("uses a per-request nonce and limits external connections", () => {
    const policy = buildContentSecurityPolicy("nonce-123", "https://project.supabase.co");
    expect(policy).toContain("script-src 'self' 'nonce-nonce-123' 'strict-dynamic'");
    expect(policy).toContain("connect-src 'self' https://project.supabase.co wss://project.supabase.co");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
