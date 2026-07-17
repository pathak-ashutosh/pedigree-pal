import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { can } from "@/domain/rbac";
import type { OrganizationSummary } from "@/lib/organizations/dal";
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

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href={basePath}>PP / PedigreePal</Link>
        <div className={styles.organizationLabel}>
          <span>Workspace</span>
          <strong>{organization.name}</strong>
          <small>{organization.role}</small>
        </div>
        <nav aria-label="Workspace">
          <Link href={basePath}>Overview</Link>
          <Link href={`${basePath}/dogs`}>Dogs</Link>
          <span>Pedigrees</span>
          <span>Evidence</span>
          <span>Team</span>
          {can(organization.role, "audit:read") ? (
            <Link href={`${basePath}/audit`}>Audit log</Link>
          ) : (
            <span>Audit log</span>
          )}
          {can(organization.role, "organization:manage") ? (
            <>
              <Link href={`${basePath}/billing`}>Billing</Link>
              <Link href={`${basePath}/developer`}>Developer</Link>
            </>
          ) : (
            <span>Billing</span>
          )}
        </nav>
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
