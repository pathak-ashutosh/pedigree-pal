import { createHash, randomBytes } from "node:crypto";

const apiKeyPattern = /^pp_(?:live|test)_[a-f0-9]{48}$/;

export function hashApiKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateApiKey(mode: "live" | "test" = "live") {
  const token = randomBytes(24).toString("hex");
  const raw = `pp_${mode}_${token}`;
  return {
    raw,
    prefix: `pp_${mode}_${token.slice(0, 10)}`,
    hash: hashApiKey(raw),
  };
}

export function readBearerApiKey(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const key = authorization.slice(7);
  return apiKeyPattern.test(key) ? key : null;
}
