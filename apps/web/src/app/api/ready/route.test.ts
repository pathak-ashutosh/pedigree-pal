import { vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { createReadyHandler } from "./route";

function setup(error: null | { code: string }) {
  const select = vi.fn().mockResolvedValue({ data: null, error });
  const from = vi.fn(() => ({ select }));
  const activeLogger = { info: vi.fn(), error: vi.fn() };
  const times = [100, 107];
  const handler = createReadyHandler({
    admin: (() => ({ from })) as never,
    activeLogger,
    now: () => times.shift() ?? 107,
    requestId: () => "request-1",
  });
  return { handler, activeLogger };
}

describe("readiness API", () => {
  it("reports database readiness without caching", async () => {
    const current = setup(null);
    const response = await current.handler(new Request("https://app.example.test/api/ready"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ready", service: "pedigree-pal-web" });
    expect(current.activeLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "readiness.checked", durationMs: 7 }),
      "readiness check",
    );
  });

  it("fails closed and logs only the provider error code", async () => {
    const current = setup({ code: "connection_failed" });
    const response = await current.handler(new Request("https://app.example.test/api/ready"));
    expect(response.status).toBe(503);
    expect(current.activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "readiness.failed", errorCode: "connection_failed" }),
      "readiness check failed",
    );
  });

  it("normalizes missing or invalid server configuration", async () => {
    const activeLogger = { info: vi.fn(), error: vi.fn() };
    const handler = createReadyHandler({
      admin: (() => { throw new Error("secret config"); }) as never,
      activeLogger,
      requestId: () => "request-1",
    });
    expect((await handler(new Request("https://app.example.test/api/ready"))).status).toBe(503);
    expect(activeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "configuration_error" }),
      "readiness check failed",
    );
  });
});
