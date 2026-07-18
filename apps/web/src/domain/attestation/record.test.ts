import { canonicalize } from "./canonical";
import {
  attestableDogSchema,
  RECORD_SCHEMA_ID,
  RECORD_SCHEMA_VERSION,
  toCanonicalRecord,
  type AttestableDog,
} from "./record";

const dog: AttestableDog = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  version: 1,
  registeredName: "Ashwood Northern Light",
  callName: null,
  breed: "Bernese Mountain Dog",
  sex: "female",
  birthDate: "2024-03-19",
  microchipHash: null,
  sireId: null,
  damId: null,
};

describe("toCanonicalRecord", () => {
  it("stamps the schema id and version into the hashed payload", () => {
    expect(toCanonicalRecord(dog)).toMatchObject({
      schema: RECORD_SCHEMA_ID,
      schemaVersion: RECORD_SCHEMA_VERSION,
    });
  });

  it("covers exactly the frozen v1 field list", () => {
    expect(Object.keys(toCanonicalRecord(dog) as object).sort()).toEqual([
      "birthDate",
      "breed",
      "callName",
      "damId",
      "id",
      "microchipHash",
      "organizationId",
      "registeredName",
      "schema",
      "schemaVersion",
      "sex",
      "sireId",
      "version",
    ]);
  });

  it("ignores fields outside the projection", () => {
    const withExtras = { ...dog, status: "archived", notes: "internal note" };
    expect(canonicalize(toCanonicalRecord(withExtras as AttestableDog))).toBe(
      canonicalize(toCanonicalRecord(dog)),
    );
  });

  it("keeps absent optional fields as explicit nulls", () => {
    expect(toCanonicalRecord(dog)).toMatchObject({
      callName: null,
      microchipHash: null,
      sireId: null,
      damId: null,
    });
  });

  it("rejects an undefined optional rather than hashing a partial record", () => {
    expect(() => toCanonicalRecord({ ...dog, callName: undefined as never })).toThrow();
  });

  it.each([
    ["id", { id: "nope" }],
    ["organizationId", { organizationId: "nope" }],
    ["sex", { sex: "other" }],
    ["birthDate", { birthDate: "19-03-2024" }],
    ["microchipHash casing", { microchipHash: "B".repeat(64) }],
    ["microchipHash length", { microchipHash: "b".repeat(63) }],
    ["version floor", { version: 0 }],
    ["registeredName emptiness", { registeredName: "" }],
  ])("rejects an invalid %s", (_label, patch) => {
    expect(() => attestableDogSchema.parse({ ...dog, ...patch })).toThrow();
  });
});
