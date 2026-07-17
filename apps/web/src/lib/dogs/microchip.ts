import { createHash } from "node:crypto";

export function normalizeMicrochip(value: string): string {
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{8,32}$/.test(normalized)) {
    throw new Error("Microchip ID must contain 8–32 letters or numbers.");
  }
  return normalized;
}

export function fingerprintMicrochip(value: string): string {
  return createHash("sha256").update(normalizeMicrochip(value), "utf8").digest("hex");
}
