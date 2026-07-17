# Observability

## Log contract

Browser and server emit one-line JSON with stable fields:

- `time`/`timestamp`, `level`, `service`, `release`, `event`
- `requestId`, route/method/status/duration where applicable
- error category/code, never raw provider or customer payloads

Server logs use Pino. Browser logs use `frontend/src/lib/logger.js`. Event names are domain-first (`auth.magic_link.sent`, `health.checked`, `dog.registration_failed`).

## Privacy

Redaction is configured and tested for authorization, cookies, tokens, secrets, passwords, email, and wallet addresses. Never log dog data, evidence, session material, signatures, private keys, magic-link codes, or billing payloads.

## Current capture

- Browser global errors, rejected promises, React render failures
- Auth success/failure lifecycle without identity data
- HTTP health request ID, route, status, duration
- Readiness/database state, billing checkout/webhook transitions, API authentication/quota/results
- API-key lifecycle and async/operator failure counts
- Release/service metadata on server events

`LOG_LEVEL` controls server verbosity; `RELEASE_SHA` identifies the deployment. `/api/health` is liveness; `/api/ready` verifies database readiness. Both return `x-request-id` and `cache-control: no-store`.

## Production completion

Before launch, route stdout JSON to the selected managed backend and define dashboards for availability, latency, 5xx, quota denial, webhook failure, billing drift, and outbox age. Add distributed traces when the selected host is known. Page only on actionable burn-rate/security signals. Exercise alerts and runbooks in staging.
