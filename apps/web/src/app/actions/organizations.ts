"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { organizationInputSchema } from "@/domain/organizations";
import type { OrganizationActionState } from "@/lib/organizations/state";
import { logger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";

export async function createOrganization(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const result = organizationInputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: "Check the workspace name and URL.",
      errors: z.flattenError(result.error).fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    organization_name: result.data.name,
    organization_slug: result.data.slug,
  });

  if (error || !data) {
    const duplicate = error?.code === "23505";
    logger.warn(
      { event: "organization.create_failed", errorCode: error?.code ?? "empty_result" },
      "organization creation failed",
    );
    return {
      status: "error",
      message: duplicate
        ? "That workspace URL is already taken."
        : "We could not create the workspace. Try again shortly.",
    };
  }

  logger.info({ event: "organization.created" }, "organization created");
  redirect(`/dashboard/${result.data.slug}`);
}
