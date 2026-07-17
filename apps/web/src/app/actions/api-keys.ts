"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/domain/rbac";
import { generateApiKey } from "@/lib/api/keys";
import type { ApiKeyActionState } from "@/lib/api/state";
import { getOrganizationAccess } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";

const createSchema = z.object({
  organizationSlug: z.string().min(2).max(63),
  name: z.string().trim().min(2).max(80),
});

const revokeSchema = z.object({
  organizationSlug: z.string().min(2).max(63),
  keyId: z.uuid(),
});

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function authorize(organizationSlug: string) {
  const access = await getOrganizationAccess(organizationSlug);
  return access && can(access.role, "organization:manage") ? access : null;
}

export async function createApiKey(
  _previousState: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const input = createSchema.safeParse(values(formData));
  if (!input.success) {
    return { status: "error", message: "Enter a key name between 2 and 80 characters." };
  }
  const access = await authorize(input.data.organizationSlug);
  if (!access) {
    logger.warn({ event: "api_key.access_denied" }, "API key access denied");
    return { status: "error", message: "Organization administrator access required." };
  }

  const credential = generateApiKey();
  const result = await access.supabase
    .from("api_keys")
    .insert({
      organization_id: access.id,
      name: input.data.name,
      key_prefix: credential.prefix,
      key_hash: credential.hash,
      scopes: ["dogs:read"],
      created_by: access.userId,
    })
    .select("id")
    .maybeSingle();
  if (result.error || !result.data) {
    logger.error(
      { event: "api_key.create_failed", errorCode: result.error?.code ?? "empty_result" },
      "API key creation failed",
    );
    return { status: "error", message: "API key could not be created." };
  }

  logger.info({ event: "api_key.created" }, "API key created");
  revalidatePath(`/dashboard/${input.data.organizationSlug}/developer`);
  return {
    status: "created",
    message: "Copy this key now. It will not be shown again.",
    key: credential.raw,
  };
}

export async function revokeApiKey(
  _previousState: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const input = revokeSchema.safeParse(values(formData));
  if (!input.success) {
    return { status: "error", message: "API key reference is invalid." };
  }
  const access = await authorize(input.data.organizationSlug);
  if (!access) {
    return { status: "error", message: "Organization administrator access required." };
  }

  const result = await access.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.data.keyId)
    .eq("organization_id", access.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data) {
    logger.error(
      { event: "api_key.revoke_failed", errorCode: result.error?.code ?? "not_found" },
      "API key revocation failed",
    );
    return { status: "error", message: "API key could not be revoked." };
  }

  logger.info({ event: "api_key.revoked" }, "API key revoked");
  revalidatePath(`/dashboard/${input.data.organizationSlug}/developer`);
  return { status: "saved", message: "API key revoked." };
}
