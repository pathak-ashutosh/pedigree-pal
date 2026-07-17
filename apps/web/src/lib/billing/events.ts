export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export type BillingEventMutation = {
  organizationId: string;
  customerId?: string;
  subscriptionId?: string;
  status?: SubscriptionStatus;
  plan?: string;
  priceId?: string;
  currentPeriodEnd?: string;
  registryWriteEnabled?: boolean;
};

type EventShape = {
  type: string;
  data: { object: unknown };
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function metadataValue(object: Record<string, unknown>, key: string): string | undefined {
  return text(record(object.metadata)?.[key]);
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus {
  const supported: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "paused",
  ];
  return supported.find((status) => status === value) ?? "incomplete";
}

function periodEnd(object: Record<string, unknown>, firstItem: Record<string, unknown> | null) {
  const value = firstItem?.current_period_end ?? object.current_period_end;
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1_000).toISOString()
    : undefined;
}

export function parseStripeBillingEvent(event: EventShape): BillingEventMutation | null {
  const object = record(event.data.object);
  if (!object) {
    return null;
  }

  if (event.type === "checkout.session.completed") {
    const organizationId = text(object.client_reference_id)
      ?? metadataValue(object, "organization_id");
    if (!organizationId) {
      return null;
    }
    return {
      organizationId,
      customerId: text(object.customer),
      subscriptionId: text(object.subscription),
      plan: metadataValue(object, "plan"),
    };
  }

  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]
    .includes(event.type)) {
    return null;
  }

  const organizationId = metadataValue(object, "organization_id");
  if (!organizationId) {
    return null;
  }
  const items = record(object.items);
  const itemData = Array.isArray(items?.data) ? items.data : [];
  const firstItem = record(itemData[0]);
  const price = record(firstItem?.price);
  const status = event.type === "customer.subscription.deleted"
    ? "canceled"
    : normalizeSubscriptionStatus(object.status);

  return {
    organizationId,
    customerId: text(object.customer),
    subscriptionId: text(object.id),
    status,
    plan: metadataValue(object, "plan"),
    priceId: text(price?.id),
    currentPeriodEnd: periodEnd(object, firstItem),
    registryWriteEnabled: status === "active" || status === "trialing",
  };
}
