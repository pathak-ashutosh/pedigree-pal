# Billing webhook recovery

1. Check Stripe delivery status and `billing_webhook_events` by event ID/type; never copy raw payloads into logs.
2. Resolve configuration/provider/database failure.
3. Redeliver from Stripe. The inbox enforces event ID plus payload hash and safely retries unprocessed events.
4. Confirm `organization_billing`, `registry.write`, processed timestamp, and correlated structured log.
5. If state still differs, compare against Stripe as source and apply a reviewed service-role repair with audit evidence.

Never mark an event processed before billing and entitlement writes succeed.
