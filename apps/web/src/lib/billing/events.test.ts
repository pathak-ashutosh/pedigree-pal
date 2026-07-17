import { normalizeSubscriptionStatus, parseStripeBillingEvent } from "./events";

describe("Stripe billing event normalization", () => {
  it("normalizes supported and unknown subscription states", () => {
    expect(normalizeSubscriptionStatus("active")).toBe("active");
    expect(normalizeSubscriptionStatus("paused")).toBe("paused");
    expect(normalizeSubscriptionStatus("new_provider_state")).toBe("incomplete");
  });

  it("parses completed checkout sessions", () => {
    expect(parseStripeBillingEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "org-1",
          customer: "cus_1",
          subscription: "sub_1",
          metadata: { organization_id: "ignored", plan: "pro" },
        },
      },
    })).toEqual({
      organizationId: "org-1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      plan: "pro",
    });

    expect(parseStripeBillingEvent({
      type: "checkout.session.completed",
      data: { object: { metadata: { organization_id: "org-2" } } },
    })).toEqual({ organizationId: "org-2", customerId: undefined, subscriptionId: undefined, plan: undefined });
  });

  it("parses subscription state and the current line-item period", () => {
    expect(parseStripeBillingEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          metadata: { organization_id: "org-1", plan: "starter" },
          items: { data: [{ current_period_end: 1_700_000_000, price: { id: "price_starter" } }] },
        },
      },
    })).toEqual({
      organizationId: "org-1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      status: "active",
      plan: "starter",
      priceId: "price_starter",
      currentPeriodEnd: "2023-11-14T22:13:20.000Z",
      registryWriteEnabled: true,
    });
  });

  it("fails closed for deleted and incomplete subscriptions", () => {
    const deleted = parseStripeBillingEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          metadata: { organization_id: "org-1" },
          current_period_end: 1_700_000_000,
        },
      },
    });
    expect(deleted).toMatchObject({ status: "canceled", registryWriteEnabled: false });

    const incomplete = parseStripeBillingEvent({
      type: "customer.subscription.created",
      data: { object: { status: "mystery", metadata: { organization_id: "org-1" } } },
    });
    expect(incomplete).toMatchObject({ status: "incomplete", registryWriteEnabled: false });
  });

  it("ignores irrelevant or unusable events", () => {
    expect(parseStripeBillingEvent({ type: "invoice.paid", data: { object: {} } })).toBeNull();
    expect(parseStripeBillingEvent({ type: "checkout.session.completed", data: { object: {} } })).toBeNull();
    expect(parseStripeBillingEvent({ type: "customer.subscription.updated", data: { object: {} } })).toBeNull();
    expect(parseStripeBillingEvent({ type: "checkout.session.completed", data: { object: null } })).toBeNull();
  });
});
