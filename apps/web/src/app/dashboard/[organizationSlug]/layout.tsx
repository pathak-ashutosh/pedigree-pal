import { getCurrentClaims } from "@/lib/auth/dal";
import { requireOrganization } from "@/lib/organizations/dal";
import { WorkspaceShell } from "../workspace-shell";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const [organization, claims] = await Promise.all([
    requireOrganization(organizationSlug),
    getCurrentClaims(),
  ]);

  return (
    <WorkspaceShell
      organization={organization}
      userLabel={String(claims?.email ?? "Signed in")}
    >
      {children}
    </WorkspaceShell>
  );
}
