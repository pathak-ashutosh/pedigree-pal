import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { can } from "@/domain/rbac";
import type { OrganizationSummary } from "@/lib/organizations/dal";
import { WorkspaceNav, type WorkspaceNavItem } from "./workspace-nav";
import styles from "./dashboard.module.css";

export function WorkspaceShell({
  organization,
  userLabel,
  children,
}: {
  organization: OrganizationSummary;
  userLabel: string;
  children: React.ReactNode;
}) {
  const basePath = `/dashboard/${organization.slug}`;
  const mayManage = can(organization.role, "organization:manage");
  const navItems: WorkspaceNavItem[] = [
    { label: "Overview", href: basePath, exact: true },
    { label: "Dogs", href: `${basePath}/dogs` },
    { label: "Pedigrees", note: "Soon" },
    { label: "Evidence", note: "Soon" },
    { label: "Team", note: "Soon" },
    can(organization.role, "audit:read")
      ? { label: "Audit log", href: `${basePath}/audit` }
      : { label: "Audit log", note: "Admins" },
    mayManage
      ? { label: "Billing", href: `${basePath}/billing` }
      : { label: "Billing", note: "Admins" },
    ...(mayManage ? [{ label: "Developer", href: `${basePath}/developer` }] : []),
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href={basePath}>PP / PedigreePal</Link>
        <div className={styles.organizationLabel}>
          <span>Workspace</span>
          <strong>{organization.name}</strong>
          <small>{organization.role}</small>
        </div>
        <WorkspaceNav items={navItems} />
        <div className={styles.sidebarFooter}>
          <span title={userLabel}>{userLabel}</span>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
