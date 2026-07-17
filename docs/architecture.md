# Architecture

## Production direction

```text
Browser
  -> Next.js web/BFF
       -> Supabase Auth
       -> PostgreSQL + RLS (operational truth)
       -> private object storage
       -> structured JSON logs
       -> Stripe checkout + webhook-derived entitlements
       -> API keys, quotas, transactional outbox
       -> optional Polygon attestations
```

`apps/web` is the SaaS application and the production system of record. On-chain attestations are a planned trust layer (Phase 3 in the [SaaS blueprint](saas-blueprint.md)), not part of the current system.

## Trust boundaries

- Authentication: Supabase PKCE/magic-link sessions. Server code verifies claims with `getClaims()`.
- Authorization: organization roles in application policy and PostgreSQL RLS.
- Tenancy: every customer record carries `organization_id`; composite foreign keys prevent cross-tenant pedigrees and documents.
- Files: private `pedigree-evidence` bucket; object paths start with organization UUID; signed access only.
- Billing: provider IDs/state live in a server-managed table; browser roles have read-only owner/admin access.
- API: raw keys are shown once, SHA-256 hashed at rest, tenant/scoped, atomically rate-limited, and revocable.
- Async: registry writes atomically append privacy-minimized outbox events; workers claim with `SKIP LOCKED`.
- Chain: public proofs contain hashes/attestations only. No private record is written on-chain.

## Core schema

- Organizations, memberships, invitations, billing, entitlements
- Dogs and validated sire/dam links
- Evidence document metadata and private objects
- Append-only audit events, idempotency inbox, API keys, quotas, outbox, webhook delivery state

Database constraints enforce chronology, parent sex, same-organization links, immutable last-owner safety, sizes, hashes, and uniqueness. RLS is enabled on every exposed table. Mutations emit audit events with secrets removed.

## Application boundaries

- `src/domain`: deterministic validation/RBAC
- `src/app/actions`: authenticated mutations
- `src/lib/auth`: verified identity and safe redirects
- `src/lib/supabase`: request-aware clients and session refresh
- `src/lib/server`: structured logs and request IDs
- `src/app/api`: correlated HTTP boundaries, probes, Stripe webhooks, billing, and versioned API

## Delivery

CI independently gates SaaS web, container builds, database migrations/pgTAP/lint, and production dependency audits. Production schema changes must be forward-compatible migrations with a tested restore/rollback plan.
