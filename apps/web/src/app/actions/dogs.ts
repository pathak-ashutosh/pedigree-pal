"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateSalt, hashRecord } from "@/domain/attestation/hash";
import { RECORD_SCHEMA_VERSION } from "@/domain/attestation/record";
import { DomainError, validateParentAssignment, type DogReference, type ParentKind } from "@/domain/dogs";
import { can, type Permission } from "@/domain/rbac";
import { parseDogFormData } from "@/lib/dogs/input";
import type { DogActionState } from "@/lib/dogs/state";
import { getOrganizationAccess, type OrganizationAccess } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";

const uuidSchema = z.uuid();
const parentKindSchema = z.enum(["sire", "dam"]);

function inputError(error: unknown): DogActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "Check the highlighted dog fields.",
      errors: z.flattenError(error).fieldErrors,
    };
  }
  if (error instanceof DomainError || error instanceof Error) {
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "The dog record is invalid." };
}

async function authorize(slug: string, permission: Permission): Promise<OrganizationAccess | null> {
  const access = await getOrganizationAccess(slug);
  if (!access || !can(access.role, permission)) {
    logger.warn({ event: "dog.access_denied", permission }, "dog access denied");
    return null;
  }
  return access;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function createDog(
  _previousState: DogActionState,
  formData: FormData,
): Promise<DogActionState> {
  const organizationSlug = readString(formData, "organizationSlug");
  const access = await authorize(organizationSlug, "dogs:write");
  if (!access) {
    return { status: "error", message: "You do not have permission to add dogs." };
  }

  let dog;
  try {
    dog = parseDogFormData(formData);
  } catch (error) {
    return inputError(error);
  }

  const { data, error } = await access.supabase
    .from("dogs")
    .insert({
      organization_id: access.id,
      registered_name: dog.registeredName,
      call_name: dog.callName ?? null,
      breed: dog.breed,
      sex: dog.sex,
      birth_date: dog.birthDate,
      microchip_hash: dog.microchipHash ?? null,
      notes: dog.notes ?? null,
      created_by: access.userId,
      updated_by: access.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.warn(
      { event: "dog.create_failed", errorCode: error?.code ?? "empty_result" },
      "dog creation failed",
    );
    return {
      status: "error",
      message:
        error?.code === "23505"
          ? "That microchip is already registered in this workspace."
          : "We could not create the dog record. Try again shortly.",
    };
  }

  logger.info({ event: "dog.created" }, "dog created");
  revalidatePath(`/dashboard/${organizationSlug}`);
  redirect(`/dashboard/${organizationSlug}/dogs/${data.id}`);
}

export async function updateDog(
  _previousState: DogActionState,
  formData: FormData,
): Promise<DogActionState> {
  const organizationSlug = readString(formData, "organizationSlug");
  const dogIdResult = uuidSchema.safeParse(readString(formData, "dogId"));
  if (!dogIdResult.success) {
    return { status: "error", message: "The dog record ID is invalid." };
  }

  const access = await authorize(organizationSlug, "dogs:write");
  if (!access) {
    return { status: "error", message: "You do not have permission to edit dogs." };
  }

  let dog;
  try {
    dog = parseDogFormData(formData);
  } catch (error) {
    return inputError(error);
  }

  const update: Record<string, unknown> = {
    registered_name: dog.registeredName,
    call_name: dog.callName ?? null,
    breed: dog.breed,
    sex: dog.sex,
    birth_date: dog.birthDate,
    notes: dog.notes ?? null,
    updated_by: access.userId,
  };
  if (readString(formData, "microchip").trim()) {
    update.microchip_hash = dog.microchipHash;
  }

  const { data, error } = await access.supabase
    .from("dogs")
    .update(update)
    .eq("id", dogIdResult.data)
    .eq("organization_id", access.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    logger.warn(
      { event: "dog.update_failed", errorCode: error?.code ?? "not_found" },
      "dog update failed",
    );
    return {
      status: "error",
      message:
        error?.code === "23505"
          ? "That microchip is already registered in this workspace."
          : "We could not update the dog record.",
    };
  }

  logger.info({ event: "dog.updated" }, "dog updated");
  revalidatePath(`/dashboard/${organizationSlug}`);
  redirect(`/dashboard/${organizationSlug}/dogs/${dogIdResult.data}`);
}

export async function setDogParent(
  _previousState: DogActionState,
  formData: FormData,
): Promise<DogActionState> {
  const organizationSlug = readString(formData, "organizationSlug");
  const childId = uuidSchema.safeParse(readString(formData, "childId"));
  const parentId = uuidSchema.safeParse(readString(formData, "parentId"));
  const kind = parentKindSchema.safeParse(readString(formData, "kind"));
  if (!childId.success || !parentId.success || !kind.success) {
    return { status: "error", message: "Choose a valid parent record." };
  }

  const access = await authorize(organizationSlug, "dogs:write");
  if (!access) {
    return { status: "error", message: "You do not have permission to edit pedigrees." };
  }

  const { data: dogData, error: dogError } = await access.supabase
    .from("dogs")
    .select("id, organization_id, sex, birth_date")
    .eq("organization_id", access.id)
    .in("id", [childId.data, parentId.data]);

  if (dogError || !dogData || dogData.length !== 2) {
    logger.warn(
      { event: "pedigree.parent_lookup_failed", errorCode: dogError?.code ?? "not_found" },
      "parent lookup failed",
    );
    return { status: "error", message: "The selected parent record is unavailable." };
  }

  const references = dogData as Array<{
    id: string;
    organization_id: string;
    sex: DogReference["sex"];
    birth_date: string;
  }>;
  const child = references.find((dog) => dog.id === childId.data);
  const parent = references.find((dog) => dog.id === parentId.data);
  if (!child || !parent) {
    return { status: "error", message: "The selected parent record is unavailable." };
  }

  try {
    validateParentAssignment(
      {
        id: child.id,
        organizationId: child.organization_id,
        sex: child.sex,
        birthDate: child.birth_date,
      },
      {
        id: parent.id,
        organizationId: parent.organization_id,
        sex: parent.sex,
        birthDate: parent.birth_date,
      },
      kind.data,
    );
  } catch (error) {
    return inputError(error);
  }

  const { data: existing, error: existingError } = await access.supabase
    .from("dog_parents")
    .select("child_id")
    .eq("child_id", childId.data)
    .eq("kind", kind.data)
    .maybeSingle();

  if (existingError) {
    logger.warn(
      { event: "pedigree.lookup_failed", errorCode: existingError.code },
      "pedigree lookup failed",
    );
    return { status: "error", message: "We could not inspect the pedigree link." };
  }

  const mutation = existing
    ? access.supabase
        .from("dog_parents")
        .update({ parent_id: parentId.data })
        .eq("child_id", childId.data)
        .eq("kind", kind.data)
    : access.supabase.from("dog_parents").insert({
        organization_id: access.id,
        child_id: childId.data,
        parent_id: parentId.data,
        kind: kind.data as ParentKind,
        created_by: access.userId,
      });
  const { error: mutationError } = await mutation.select("child_id").maybeSingle();

  if (mutationError) {
    logger.warn(
      { event: "pedigree.save_failed", errorCode: mutationError.code },
      "pedigree save failed",
    );
    return { status: "error", message: "We could not save the pedigree link." };
  }

  logger.info({ event: "pedigree.parent_saved", kind: kind.data }, "pedigree parent saved");
  revalidatePath(`/dashboard/${organizationSlug}/dogs/${childId.data}`);
  return { status: "saved", message: `${kind.data === "sire" ? "Sire" : "Dam"} saved.` };
}

const finalizeFailureMessages: ReadonlyArray<[string, string]> = [
  ["already finalized", "This record is already finalized."],
  ["archived records", "Archived records cannot be finalized."],
  ["changed since it was reviewed", "The record changed while you reviewed it. Reload and try again."],
  ["not authorized", "Only organization administrators can finalize records."],
];

export async function finalizeDogRecord(
  _previousState: DogActionState,
  formData: FormData,
): Promise<DogActionState> {
  const organizationSlug = readString(formData, "organizationSlug");
  const dogId = uuidSchema.safeParse(readString(formData, "dogId"));
  if (!dogId.success) {
    return { status: "error", message: "The dog record ID is invalid." };
  }

  const access = await authorize(organizationSlug, "dogs:attest");
  if (!access) {
    return { status: "error", message: "Only organization administrators can finalize records." };
  }

  const [dogResult, parentResult] = await Promise.all([
    access.supabase
      .from("dogs")
      .select(
        "id, organization_id, registered_name, call_name, breed, sex, birth_date, microchip_hash, record_version, updated_at",
      )
      .eq("id", dogId.data)
      .eq("organization_id", access.id)
      .maybeSingle(),
    access.supabase
      .from("dog_parents")
      .select("kind, parent_id")
      .eq("child_id", dogId.data)
      .eq("organization_id", access.id),
  ]);

  if (dogResult.error || !dogResult.data || parentResult.error) {
    logger.warn(
      {
        event: "attestation.record_lookup_failed",
        errorCode: dogResult.error?.code ?? parentResult.error?.code ?? "not_found",
      },
      "attestation record lookup failed",
    );
    return { status: "error", message: "The dog record is unavailable." };
  }

  const dog = dogResult.data as {
    id: string;
    organization_id: string;
    registered_name: string;
    call_name: string | null;
    breed: string;
    sex: DogReference["sex"];
    birth_date: string;
    microchip_hash: string | null;
    record_version: number;
    updated_at: string;
  };
  const parents = (parentResult.data ?? []) as Array<{ kind: ParentKind; parent_id: string }>;
  const sireId = parents.find((parent) => parent.kind === "sire")?.parent_id ?? null;
  const damId = parents.find((parent) => parent.kind === "dam")?.parent_id ?? null;

  const salt = generateSalt();
  let recordHash: string;
  try {
    recordHash = hashRecord(
      {
        id: dog.id,
        organizationId: dog.organization_id,
        version: dog.record_version,
        registeredName: dog.registered_name,
        callName: dog.call_name,
        breed: dog.breed,
        sex: dog.sex,
        birthDate: dog.birth_date,
        microchipHash: dog.microchip_hash,
        sireId,
        damId,
      },
      salt,
    );
  } catch {
    logger.warn({ event: "attestation.hash_failed" }, "attestation hash failed");
    return { status: "error", message: "The record does not meet the attestation schema yet." };
  }

  const { error: rpcError } = await access.supabase.rpc("finalize_dog_record", {
    dog_id: dog.id,
    record_hash: recordHash,
    salt,
    schema_version: RECORD_SCHEMA_VERSION,
    expected_updated_at: dog.updated_at,
    expected_sire_id: sireId,
    expected_dam_id: damId,
  });

  if (rpcError) {
    logger.warn(
      { event: "attestation.finalize_failed", errorCode: rpcError.code },
      "attestation finalize failed",
    );
    const known = finalizeFailureMessages.find(([needle]) => rpcError.message?.includes(needle));
    return {
      status: "error",
      message: known?.[1] ?? "We could not finalize the record. Try again shortly.",
    };
  }

  logger.info(
    { event: "attestation.finalized", recordVersion: dog.record_version },
    "dog record finalized",
  );
  revalidatePath(`/dashboard/${organizationSlug}/dogs/${dog.id}`);
  return {
    status: "saved",
    message: `Version ${dog.record_version} finalized and queued for attestation.`,
  };
}

export async function archiveDog(
  _previousState: DogActionState,
  formData: FormData,
): Promise<DogActionState> {
  const organizationSlug = readString(formData, "organizationSlug");
  const dogId = uuidSchema.safeParse(readString(formData, "dogId"));
  if (!dogId.success) {
    return { status: "error", message: "The dog record ID is invalid." };
  }

  const access = await authorize(organizationSlug, "dogs:delete");
  if (!access) {
    return { status: "error", message: "Only organization administrators can archive dogs." };
  }

  const { data, error } = await access.supabase
    .from("dogs")
    .update({ status: "archived", updated_by: access.userId })
    .eq("id", dogId.data)
    .eq("organization_id", access.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    logger.warn(
      { event: "dog.archive_failed", errorCode: error?.code ?? "not_found" },
      "dog archive failed",
    );
    return { status: "error", message: "We could not archive the dog record." };
  }

  logger.info({ event: "dog.archived" }, "dog archived");
  revalidatePath(`/dashboard/${organizationSlug}`);
  redirect(`/dashboard/${organizationSlug}/dogs`);
}
