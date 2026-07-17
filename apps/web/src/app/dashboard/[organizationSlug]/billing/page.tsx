import { requireOrganization } from "@/lib/organizations/dal";
import { logger } from "@/lib/server/logger";
import { CheckoutForm } from "./checkout-form";
import styles from "./billing.module.css";

type BillingRow = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type EntitlementRow = {
  entitlement_key: string;
  value: unknown;
  source: string;
};

export default async function BillingPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const access = await requireOrganization(organizationSlug, "organization:manage");
  const [billingResult, entitlementResult] = await Promise.all([
    access.supabase
      .from("organization_billing")
      .select("plan, status, current_period_end")
      .eq("organization_id", access.id)
      .maybeSingle(),
    access.supabase
      .from("organization_entitlements")
      .select("entitlement_key, value, source")
      .eq("organization_id", access.id)
      .order("entitlement_key"),
  ]);

  if (billingResult.error || !billingResult.data || entitlementResult.error) {
    logger.error(
      {
        event: "billing.page_load_failed",
        errorCode: billingResult.error?.code ?? entitlementResult.error?.code ?? "not_found",
      },
      "billing page load failed",
    );
    throw new Error("Billing is temporarily unavailable.");
  }

  const billing = billingResult.data as BillingRow;
  const entitlements = (entitlementResult.data ?? []) as EntitlementRow[];
  const renews = billing.current_period_end
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(billing.current_period_end))
    : "Managed by Stripe";

  return (
    <div className={styles.billingPage}>
      <header>
        <div>
          <p>Workspace billing</p>
          <h1>Plans, without surprises.</h1>
        </div>
        <span className={styles.status}>{billing.plan} · {billing.status}</span>
      </header>

      <section className={styles.summary} aria-label="Current subscription">
        <p>Current access</p>
        <strong>{billing.plan}</strong>
        <span>{billing.status} · {renews}</span>
      </section>

      <section className={styles.plans} aria-label="Available plans">
        <article>
          <span>01 / STARTER</span>
          <h2>Registry essentials</h2>
          <p>Tenant registry, pedigree records, evidence foundation, audit history.</p>
          <CheckoutForm organizationSlug={organizationSlug} plan="starter" />
        </article>
        <article>
          <span>02 / PRO</span>
          <h2>Operational scale</h2>
          <p>Higher limits plus API keys, webhooks, and expanded operational capacity.</p>
          <CheckoutForm organizationSlug={organizationSlug} plan="pro" />
        </article>
      </section>

      <section className={styles.entitlements}>
        <div>
          <p>Effective controls</p>
          <h2>Entitlements</h2>
        </div>
        <ul>
          {entitlements.map((entitlement) => (
            <li key={entitlement.entitlement_key}>
              <code>{entitlement.entitlement_key}</code>
              <strong>{String(entitlement.value)}</strong>
              <span>{entitlement.source}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
