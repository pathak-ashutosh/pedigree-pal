import { hashRequestPayload, parseIdempotencyKey } from "./idempotency";

describe("idempotency", () => {
  it("accepts bounded opaque keys", () => {
    expect(parseIdempotencyKey("request_1234567890")).toBe("request_1234567890");
  });

  it.each([null, "short", "bad key that contains spaces", "x".repeat(129)])(
    "rejects unsafe key %s",
    (value) => expect(parseIdempotencyKey(value)).toBeNull(),
  );

  it("hashes exact payload bytes deterministically", () => {
    expect(hashRequestPayload('{"a":1}')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRequestPayload('{"a":1}')).not.toBe(hashRequestPayload('{"a":2}'));
  });
});
