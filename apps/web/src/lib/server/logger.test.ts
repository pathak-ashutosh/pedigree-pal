import type { DestinationStream } from "pino";
import { createServerLogger } from "./logger";
import { getRequestId } from "./request";

describe("server logging", () => {
  it("writes structured logs and redacts sensitive fields", () => {
    const output: string[] = [];
    const destination: DestinationStream = {
      write(message) {
        output.push(message);
        return true;
      },
    };
    const testLogger = createServerLogger(destination);

    testLogger.info(
      {
        event: "auth.magic_link.requested",
        email: "person@example.com",
        apiKey: "pp_live_secret",
        idempotencyKey: "checkout-secret",
        stripeSignature: "provider-signature",
        payload: { private: "customer-data" },
        account: { token: "nested-token" },
        req: { headers: { authorization: "Bearer secret", cookie: "session=secret" } },
      },
      "auth request",
    );

    const entry = JSON.parse(output[0]);
    expect(entry).toMatchObject({
      level: 30,
      event: "auth.magic_link.requested",
      email: "[REDACTED]",
      service: "pedigree-pal-web",
    });
    expect(entry.req.headers).toEqual({ authorization: "[REDACTED]", cookie: "[REDACTED]" });
    expect(output[0]).not.toContain("person@example.com");
    expect(output[0]).not.toContain("Bearer secret");
    expect(output[0]).not.toContain("nested-token");
    expect(output[0]).not.toContain("pp_live_secret");
    expect(output[0]).not.toContain("checkout-secret");
    expect(output[0]).not.toContain("provider-signature");
    expect(output[0]).not.toContain("customer-data");
  });
});

describe("request IDs", () => {
  it("keeps a safe upstream ID", () => {
    expect(getRequestId(new Request("https://example.test", { headers: { "x-request-id": "edge-123" } }))).toBe(
      "edge-123",
    );
  });

  it("replaces unsafe input", () => {
    expect(
      getRequestId(
        new Request("https://example.test", { headers: { "x-request-id": "x".repeat(65) } }),
        () => "generated-id",
      ),
    ).toBe("generated-id");
  });
});
