import { DomainError, dogInputSchema, parseDogInput, validateParentAssignment } from "./dogs";

const validDog = {
  registeredName: "  Northstar Juniper  ",
  callName: "  ",
  breed: "Golden Retriever",
  sex: "female" as const,
  birthDate: "2024-01-15",
  microchipHash: "a".repeat(64),
  notes: "  ",
};

describe("dog input", () => {
  it("normalizes safe input", () => {
    expect(parseDogInput(validDog, new Date("2026-07-15T12:00:00Z"))).toEqual({
      ...validDog,
      registeredName: "Northstar Juniper",
      callName: undefined,
      notes: undefined,
    });
  });

  it("rejects malformed identifiers and future dates", () => {
    expect(dogInputSchema.safeParse({ ...validDog, microchipHash: "raw-chip-id" }).success).toBe(false);
    expect(() => parseDogInput(validDog, new Date("2023-01-01T12:00:00Z"))).toThrow(
      expect.objectContaining({ code: "FUTURE_BIRTH_DATE" }),
    );
  });
});

describe("pedigree parent rules", () => {
  const child = {
    id: "child",
    organizationId: "org-a",
    sex: "female" as const,
    birthDate: "2024-01-15",
  };
  const sire = {
    id: "sire",
    organizationId: "org-a",
    sex: "male" as const,
    birthDate: "2020-05-10",
  };

  it("accepts a valid parent", () => {
    expect(() => validateParentAssignment(child, sire, "sire")).not.toThrow();
  });

  it.each([
    ["self", child, "sire", "SELF_PARENT"],
    ["another organization", { ...sire, organizationId: "org-b" }, "sire", "CROSS_ORGANIZATION_PARENT"],
    ["wrong sex", { ...sire, sex: "female" }, "sire", "PARENT_SEX_MISMATCH"],
    ["younger parent", { ...sire, birthDate: "2025-01-01" }, "sire", "PARENT_NOT_OLDER"],
  ] as const)("rejects %s", (_label, parent, kind, code) => {
    expect(() => validateParentAssignment(child, parent, kind)).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code }),
    );
  });
});
