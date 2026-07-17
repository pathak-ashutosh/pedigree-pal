import { fingerprintMicrochip, normalizeMicrochip } from "./microchip";

describe("microchip privacy", () => {
  it("normalizes common formatting", () => {
    expect(normalizeMicrochip(" 985-141 000 123 456 ")).toBe("985141000123456");
  });

  it.each(["short", "1234!567", "a".repeat(33)])("rejects unsafe value %s", (value) => {
    expect(() => normalizeMicrochip(value)).toThrow(/8–32 letters or numbers/i);
  });

  it("creates a deterministic SHA-256 fingerprint without retaining the input", () => {
    const fingerprint = fingerprintMicrochip("985141000123456");
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintMicrochip("985-141-000-123-456")).toBe(fingerprint);
    expect(fingerprint).not.toContain("985141000123456");
  });
});
