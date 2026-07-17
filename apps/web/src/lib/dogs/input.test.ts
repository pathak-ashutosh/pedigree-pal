import { parseDogFormData } from "./input";

function dogForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    registeredName: "Northstar Juniper",
    callName: "June",
    breed: "Golden Retriever",
    sex: "female",
    birthDate: "2024-01-15",
    microchip: "985-141-000-123-456",
    notes: "Reviewed source record.",
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("dog form input", () => {
  it("parses and fingerprints the raw microchip", () => {
    const result = parseDogFormData(dogForm(), new Date("2026-07-15T12:00:00Z"));
    expect(result).toMatchObject({
      registeredName: "Northstar Juniper",
      callName: "June",
      sex: "female",
    });
    expect(result.microchipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("985141000123456");
  });

  it("omits optional empty fields", () => {
    const result = parseDogFormData(
      dogForm({ callName: "", microchip: "", notes: "" }),
      new Date("2026-07-15T12:00:00Z"),
    );
    expect(result.callName).toBeUndefined();
    expect(result.microchipHash).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("rejects malformed forms", () => {
    expect(() => parseDogFormData(dogForm({ sex: "invalid" }))).toThrow();
    expect(() => parseDogFormData(dogForm({ microchip: "unsafe" }))).toThrow();
  });
});
