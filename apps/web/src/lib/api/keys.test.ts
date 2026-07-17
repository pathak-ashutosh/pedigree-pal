import { generateApiKey, hashApiKey, readBearerApiKey } from "./keys";

describe("API keys", () => {
  it("generates one-time live and test credentials with safe stored derivatives", () => {
    for (const mode of ["live", "test"] as const) {
      const key = generateApiKey(mode);
      expect(key.raw).toMatch(new RegExp(`^pp_${mode}_[a-f0-9]{48}$`));
      expect(key.prefix).toMatch(new RegExp(`^pp_${mode}_[a-f0-9]{10}$`));
      expect(key.hash).toBe(hashApiKey(key.raw));
      expect(key.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("accepts only exact bearer API-key syntax", () => {
    const key = "pp_live_" + "a".repeat(48);
    expect(readBearerApiKey(`Bearer ${key}`)).toBe(key);
    expect(readBearerApiKey(null)).toBeNull();
    expect(readBearerApiKey(key)).toBeNull();
    expect(readBearerApiKey("Bearer pp_live_short")).toBeNull();
    expect(readBearerApiKey(`bearer ${key}`)).toBeNull();
  });
});
