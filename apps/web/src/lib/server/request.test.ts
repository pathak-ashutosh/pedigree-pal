import {
  getRequestId,
  hasJsonContentType,
  readLimitedRequestText,
  RequestBodyTooLargeError,
} from "./request";

describe("request hardening", () => {
  it("accepts valid upstream IDs and replaces invalid ones", () => {
    expect(getRequestId(new Request("https://app.test", {
      headers: { "x-request-id": "trace_123" },
    }), () => "generated")).toBe("trace_123");
    expect(getRequestId(new Request("https://app.test", {
      headers: { "x-request-id": "bad value" },
    }), () => "generated")).toBe("generated");
  });

  it("recognizes JSON with an optional charset", () => {
    expect(hasJsonContentType(new Request("https://app.test", {
      headers: { "content-type": "application/json; charset=utf-8" },
    }))).toBe(true);
    expect(hasJsonContentType(new Request("https://app.test", {
      headers: { "content-type": "text/plain" },
    }))).toBe(false);
    expect(hasJsonContentType(new Request("https://app.test"))).toBe(false);
  });

  it("reads within limits and rejects oversized streams", async () => {
    await expect(readLimitedRequestText(new Request("https://app.test", {
      method: "POST",
      body: "safe",
    }), 4)).resolves.toBe("safe");
    await expect(readLimitedRequestText(new Request("https://app.test", {
      method: "POST",
      body: "too large",
    }), 4)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    await expect(readLimitedRequestText(new Request("https://app.test", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "x",
    }), 4)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    await expect(readLimitedRequestText(new Request("https://app.test"), 4)).resolves.toBe("");
  });
});
