import Link from "next/link";
import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import styles from "../dashboard.module.css";

type AuditRow = {
  id: number;
  action: string;
  entity_type: string;
  created_at: string;
};

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const access = await requireOrganization(organizationSlug);
  const { supabase, id: organizationId } = access;
  const [dogs, members, audit, billing] = await Promise.all([
    supabase
      .from("dogs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "archived"),
    supabase
      .from("organization_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("audit_events")
      .select("id, action, entity_type, created_at", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("organization_billing")
      .select("plan, status, current_period_end")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const queryError = dogs.error ?? members.error ?? audit.error ?? billing.error;
  if (queryError) {
    logger.error(
      { event: "dashboard.load_failed", errorCode: queryError.code },
      "dashboard load failed",
    );
    throw new Error("Workspace overview is temporarily unavailable.");
  }

  const cards = [
    { label: "Active dogs", value: dogs.count ?? 0, note: "Tenant registry records" },
    { label: "Team members", value: members.count ?? 0, note: "All workspace roles" },
    { label: "Recorded changes", value: audit.count ?? 0, note: "Append-only audit events" },
  ];
  const activity = (audit.data ?? []) as AuditRow[];

  return (
    <>
      <header>
        <div>
          <p>Workspace overview</p>
          <h1>Good records start here.</h1>
        </div>
        <span className={styles.planStatus}>
          {billing.data?.plan ?? "trial"} · {billing.data?.status ?? "trialing"}
        </span>
      </header>
      <section className={styles.cards} aria-label="Workspace totals">
        {cards.map((card) => (
          <article key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <span>{card.note}</span>
          </article>
        ))}
      </section>
      <section className={styles.activitySection}>
        <div className={styles.sectionHeading}>
          <div>
            <p>Registry activity</p>
            <h2>Recent changes</h2>
          </div>
          <Link href={`/dashboard/${organizationSlug}/dogs`}>Open dog registry →</Link>
        </div>
        {activity.length > 0 ? (
          <ol className={styles.activityList}>
            {activity.map((event) => (
              <li key={event.id}>
                <span>{event.action}</span>
                <strong>{event.entity_type.replaceAll("_", " ")}</strong>
                <time dateTime={event.created_at}>
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                    new Date(event.created_at),
                  )}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.empty}>
            <p>PP / FIRST RECORD</p>
            <h2>Add the first dog to begin the organization history.</h2>
            <p>Every later change will appear here with its actor and source record.</p>
            <Link href={`/dashboard/${organizationSlug}/dogs/new`}>Add first dog →</Link>
          </div>
        )}
      </section>
    </>
  );
}
