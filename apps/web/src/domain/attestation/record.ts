import { z } from "zod";
import { dogSexes } from "@/domain/dogs";
import type { CanonicalValue } from "./canonical";

export const RECORD_SCHEMA_ID = "pedigreepal.dog";
export const RECORD_SCHEMA_VERSION = 1;

const uuid = z.uuid();
const hex64 = z.string().regex(/^[a-f0-9]{64}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const attestableDogSchema = z.object({
  id: uuid,
  organizationId: uuid,
  version: z.int().min(1),
  registeredName: z.string().min(1).max(120),
  callName: z.string().max(80).nullable(),
  breed: z.string().min(1).max(120),
  sex: z.enum(dogSexes),
  birthDate: isoDate,
  microchipHash: hex64.nullable(),
  sireId: uuid.nullable(),
  damId: uuid.nullable(),
});

export type AttestableDog = z.infer<typeof attestableDogSchema>;

/**
 * Projects a dog into the frozen v1 attestable shape: identity and parentage only.
 *
 * Deliberately excluded, because they change without altering what a certificate
 * claims: `status`, `notes`, timestamps, and actor columns. Parents are referenced
 * by id, so a v1 hash commits to *which* dogs were named as parents, not to their
 * contents — the proof bundle carries their records separately.
 *
 * Any change to this field list requires a new RECORD_SCHEMA_VERSION.
 */
export function toCanonicalRecord(dog: AttestableDog): CanonicalValue {
  const record = attestableDogSchema.parse(dog);

  return {
    schema: RECORD_SCHEMA_ID,
    schemaVersion: RECORD_SCHEMA_VERSION,
    id: record.id,
    organizationId: record.organizationId,
    version: record.version,
    registeredName: record.registeredName,
    callName: record.callName,
    breed: record.breed,
    sex: record.sex,
    birthDate: record.birthDate,
    microchipHash: record.microchipHash,
    sireId: record.sireId,
    damId: record.damId,
  };
}
