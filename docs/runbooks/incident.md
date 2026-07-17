# Incident response

1. Declare severity/commander; start a private incident log using UTC.
2. Check `/api/health`, `/api/ready`, release, 5xx/latency, database, auth, Stripe, outbox age.
3. Contain: disable traffic, revoke API keys, rotate provider secrets, or roll back the image as appropriate. Preserve evidence.
4. Recover with the smallest reversible change; verify tenant isolation and billing before reopening traffic.
5. Communicate impact without customer data. Follow legal/contract notification requirements.
6. Within 5 business days, publish an internal blameless review with timeline, root cause, detection gap, owners, and deadlines.

Never paste secrets, customer records, billing payloads, dog notes, or evidence into the incident channel.
