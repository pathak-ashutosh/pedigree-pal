import "server-only";

import { notFound } from "next/navigation";
import { can, organizationRoles, type OrganizationRole, type Permission } from "@/domain/rbac";
import { getCurrentClaims, requireUser } from "@/lib/auth/dal";
import { logger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

export type OrganizationAccess = OrganizationSummary & {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

type OrganizationRow = { id: string; name: string; slug: string };
type MembershipRow = { organization_id: string; role: string };

function parseRole(value: string): OrganizationRole | null {
  return organizationRoles.find((role) => role === value) ?? null;
}

function failQuery(event: string, errorCode?: string): never {
  logger.error({ event, errorCode: errorCode ?? "unknown" }, "organization query failed");
  throw new Error("Organization data is temporarily unavailable.");
}

export async function listOrganizationsForCurrentUser(): Promise<OrganizationSummary[]> {
  const claims = await requireUser();
  const userId = String(claims.sub);
  const supabase = await createClient();
  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (membershipError) {
    failQuery("organization.memberships_query_failed", membershipError.code);
  }

  const memberships = (membershipData ?? []) as MembershipRow[];
  if (memberships.length === 0) {
    return [];
  }

  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .in(
      "id",
      memberships.map((membership) => membership.organization_id),
    )
    .order("name");

  if (organizationError) {
    failQuery("organization.list_query_failed", organizationError.code);
  }

  const roleByOrganization = new Map(
    memberships.map((membership) => [membership.organization_id, parseRole(membership.role)]),
  );

  return ((organizationData ?? []) as OrganizationRow[]).flatMap((organization) => {
    const role = roleByOrganization.get(organization.id);
    return role ? [{ ...organization, role }] : [];
  });
}

async function loadOrganizationAccess(
  slug: string,
  userId: string,
): Promise<OrganizationAccess | null> {
  const supabase = await createClient();
  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (organizationError) {
    failQuery("organization.lookup_failed", organizationError.code);
  }
  if (!organizationData) {
    return null;
  }

  const organization = organizationData as OrganizationRow;
  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    failQuery("organization.membership_lookup_failed", membershipError.code);
  }

  const role = membershipData ? parseRole(String(membershipData.role)) : null;
  return role ? { ...organization, role, userId, supabase } : null;
}

export async function getOrganizationAccess(slug: string): Promise<OrganizationAccess | null> {
  const claims = await requireUser();
  return loadOrganizationAccess(slug, String(claims.sub));
}

export async function getOptionalOrganizationAccess(
  slug: string,
): Promise<OrganizationAccess | null> {
  const claims = await getCurrentClaims();
  return claims ? loadOrganizationAccess(slug, String(claims.sub)) : null;
}

export async function requireOrganization(
  slug: string,
  permission: Permission = "organization:read",
): Promise<OrganizationAccess> {
  const access = await getOrganizationAccess(slug);
  if (!access || !can(access.role, permission)) {
    notFound();
  }

  return access;
}
