import { AttestationHashError, generateSalt, hashRecord, SALT_BYTES } from "./hash";
import type { AttestableDog } from "./record";

const salt = "a".repeat(64);

const dog: AttestableDog = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  version: 1,
  registeredName: "Ashwood Northern Light",
  callName: "Nori",
  breed: "Bernese Mountain Dog",
  sex: "female",
  birthDate: "2024-03-19",
  microchipHash: "b".repeat(64),
  sireId: "33333333-3333-4333-8333-333333333333",
  damId: "44444444-4444-4444-8444-444444444444",
};

describe("hashRecord", () => {
  it("matches the frozen v1 vector", () => {
    // Changing this value means the v1 hash spec changed and every stored hash is
    // invalidated. Bump RECORD_SCHEMA_VERSION instead.
    expect(hashRecord(dog, salt)).toBe(
      "2276a81aae276512842408f98ce2bc8360eb0ac9509b8d74ed6b39cabd35e247",
    );
  });

  it("is stable across repeated calls and key order", () => {
    const reordered = Object.fromEntries(
      Object.entries(dog).reverse(),
    ) as unknown as AttestableDog;
    expect(hashRecord(dog, salt)).toBe(hashRecord(reordered, salt));
    expect(hashRecord(dog, salt)).toBe(hashRecord(dog, salt));
  });

  it("changes when the salt changes", () => {
    expect(hashRecord(dog, salt)).not.toBe(hashRecord(dog, "c".repeat(64)));
  });

  it.each([
    ["registeredName", { registeredName: "Ashwood Northern Lights" }],
    ["callName", { callName: "Nora" }],
    ["callName cleared", { callName: null }],
    ["breed", { breed: "Bernese Mountain Dogs" }],
    ["sex", { sex: "male" as const }],
    ["birthDate", { birthDate: "2024-03-20" }],
    ["microchipHash", { microchipHash: "c".repeat(64) }],
    ["microchipHash cleared", { microchipHash: null }],
    ["sireId", { sireId: "55555555-5555-4555-8555-555555555555" }],
    ["damId", { damId: null }],
    ["version", { version: 2 }],
    ["id", { id: "66666666-6666-4666-8666-666666666666" }],
    ["organizationId", { organizationId: "77777777-7777-4777-8777-777777777777" }],
  ])("changes when %s changes", (_label, patch) => {
    expect(hashRecord({ ...dog, ...patch }, salt)).not.toBe(hashRecord(dog, salt));
  });

  it("distinguishes a swapped sire and dam", () => {
    const swapped = { ...dog, sireId: dog.damId, damId: dog.sireId };
    expect(hashRecord(swapped, salt)).not.toBe(hashRecord(dog, salt));
  });

  it("rejects a salt that is not 32 bytes of lowercase hex", () => {
    expect(() => hashRecord(dog, "abc")).toThrow(AttestationHashError);
    expect(() => hashRecord(dog, "A".repeat(64))).toThrow(/lowercase hex/);
  });

  it("rejects a record that fails schema validation", () => {
    expect(() => hashRecord({ ...dog, id: "not-a-uuid" }, salt)).toThrow();
  });
});

describe("generateSalt", () => {
  it("returns 32 bytes of lowercase hex", () => {
    expect(generateSalt()).toMatch(new RegExp(`^[a-f0-9]{${SALT_BYTES * 2}}$`));
  });

  it("does not repeat", () => {
    const salts = new Set(Array.from({ length: 50 }, generateSalt));
    expect(salts.size).toBe(50);
  });
});
