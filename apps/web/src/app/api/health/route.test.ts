import { vi } from "vitest";
import { createHealthHandler } from "./route";

describe("health endpoint", () => {
  it("returns identity, correlation, and no-store headers", async () => {
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
      release: "development",
    });
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "health.checked", durationMs: 7, statusCode: 200 }),
      "health check",
    );
  });
});
