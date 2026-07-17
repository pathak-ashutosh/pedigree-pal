import { z } from "zod";

export const dogSexes = ["male", "female", "unknown"] as const;
export type DogSex = (typeof dogSexes)[number];
export type ParentKind = "sire" | "dam";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const sha256 = /^[a-f0-9]{64}$/;

export const dogInputSchema = z.object({
  registeredName: z.string().trim().min(1).max(120),
  callName: z.string().trim().max(80).optional(),
  breed: z.string().trim().min(1).max(120),
  sex: z.enum(dogSexes),
  birthDate: z.string().regex(isoDate),
  microchipHash: z.string().regex(sha256).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

export type DogInput = z.infer<typeof dogInputSchema>;

export class DomainError extends Error {
  constructor(
    public readonly code:
      | "FUTURE_BIRTH_DATE"
      | "SELF_PARENT"
      | "CROSS_ORGANIZATION_PARENT"
      | "PARENT_SEX_MISMATCH"
      | "PARENT_NOT_OLDER",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function parseDogInput(input: unknown, today = new Date()): DogInput {
  const dog = dogInputSchema.parse(input);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  if (new Date(`${dog.birthDate}T00:00:00.000Z`) > endOfToday) {
    throw new DomainError("FUTURE_BIRTH_DATE", "Birth date cannot be in the future.");
  }

  return {
    ...dog,
    callName: dog.callName || undefined,
    notes: dog.notes || undefined,
  };
}

export type DogReference = {
  id: string;
  organizationId: string;
  sex: DogSex;
  birthDate: string;
};

export function validateParentAssignment(
  child: DogReference,
  parent: DogReference,
  kind: ParentKind,
): void {
  if (child.id === parent.id) {
    throw new DomainError("SELF_PARENT", "A dog cannot be its own parent.");
  }

  if (child.organizationId !== parent.organizationId) {
    throw new DomainError(
      "CROSS_ORGANIZATION_PARENT",
      "Parent and child must belong to the same organization.",
    );
  }

  const requiredSex: DogSex = kind === "sire" ? "male" : "female";
  if (parent.sex !== requiredSex) {
    throw new DomainError("PARENT_SEX_MISMATCH", `A ${kind} must be ${requiredSex}.`);
  }

  if (parent.birthDate >= child.birthDate) {
    throw new DomainError("PARENT_NOT_OLDER", "A parent must be older than the child.");
  }
}
