import { afterEach, vi } from "vitest";
import { createHealthHandler } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("health endpoint", () => {
  it("returns identity, correlation, and no-store headers", async () => {
    vi.stubEnv("RELEASE_SHA", "development");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "deployed-commit");
    const info = vi.fn();
    const times = [100, 107];
    const handler = createHealthHandler({
      activeLogger: { info },
      now: () => times.shift() ?? 107,
      requestId: () => "request-1",
    });

    const response = await handler(new Request("https://example.test/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("request-1");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "pedigree-pal-web",
      release: "deployed-commit",
    });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "health.checked", durationMs: 7, statusCode: 200 }),
      "health check",
    );
  });

  it("uses an explicit release outside Vercel", async () => {
    vi.stubEnv("RELEASE_SHA", "configured-release");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    const handler = createHealthHandler({ activeLogger: { info: vi.fn() } });

    await expect(
      (await handler(new Request("https://example.test/api/health"))).json(),
    ).resolves.toMatchObject({ release: "configured-release" });
  });
});
