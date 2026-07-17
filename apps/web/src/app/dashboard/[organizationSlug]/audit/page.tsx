import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import styles from "./audit.module.css";

type AuditEvent = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  request_id: string | null;
  created_at: string;
};

export default async function AuditPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const access = await requireOrganization(organizationSlug, "audit:read");
  const result = await access.supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, actor_id, request_id, created_at")
    .eq("organization_id", access.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) {
    logger.error(
      { event: "audit.page_load_failed", errorCode: result.error.code },
      "audit page load failed",
    );
    throw new Error("Audit history is temporarily unavailable.");
  }

  const events = (result.data ?? []) as AuditEvent[];
  return (
    <div className={styles.auditPage}>
      <header>
        <div>
          <p>Append-only history</p>
          <h1>Every material change.</h1>
        </div>
        <span>{events.length} shown</span>
      </header>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.action}</strong>
            <span>{event.entity_type.replaceAll("_", " ")}</span>
            <code>{event.entity_id ?? "—"}</code>
            <code>{event.request_id ?? "no request id"}</code>
            <time dateTime={event.created_at}>
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
