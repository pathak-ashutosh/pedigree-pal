import { createHash } from "node:crypto";

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

export function parseIdempotencyKey(value: string | null): string | null {
  return value && idempotencyKeyPattern.test(value) ? value : null;
}

export function hashRequestPayload(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
