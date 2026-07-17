import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import { ApiKeyConsole, type ApiKeySummary } from "./api-key-console";
import styles from "./developer.module.css";

export default async function DeveloperPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const access = await requireOrganization(organizationSlug, "organization:manage");
  const [keys, outbox, deliveries] = await Promise.all([
    access.supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
      .eq("organization_id", access.id)
      .order("created_at", { ascending: false }),
    access.supabase
      .from("outbox_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.id)
      .in("status", ["pending", "processing"]),
    access.supabase
      .from("webhook_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.id)
      .in("status", ["retrying", "failed"]),
  ]);
  const failure = keys.error ?? outbox.error ?? deliveries.error;
  if (failure) {
    logger.error(
      { event: "developer.page_load_failed", errorCode: failure.code },
      "developer page load failed",
    );
    throw new Error("Developer controls are temporarily unavailable.");
  }

  return (
    <div className={styles.developerPage}>
      <header>
        <div>
          <p>Developer controls</p>
          <h1>Integrate, then inspect.</h1>
        </div>
      </header>

      <section className={styles.operations} aria-label="Async operations">
        <article><span>Pending jobs</span><strong>{outbox.count ?? 0}</strong></article>
        <article><span>Webhook attention</span><strong>{deliveries.count ?? 0}</strong></article>
        <article><span>API limit</span><strong>120/min</strong></article>
      </section>

      <section className={styles.apiSection}>
        <div className={styles.sectionLead}>
          <p>Versioned REST</p>
          <h2>API credentials</h2>
          <span>Keys are hashed at rest and shown once. Current scope: <code>dogs:read</code>.</span>
          <pre><code>GET /api/v1/dogs?search=June&amp;limit=50</code></pre>
        </div>
        <ApiKeyConsole organizationSlug={organizationSlug} apiKeys={(keys.data ?? []) as ApiKeySummary[]} />
      </section>
    </div>
  );
}
