# SaaS blueprint

Status: approved architecture. Phases 0–1 core complete; Phase 2 foundations active July 2026.

## Outcome

PedigreePal becomes a multi-tenant registry and verification service for owners, breeders, vets, and shelters. PostgreSQL is the operational source of truth. Blockchain stores tamper-evident attestations, never private customer data.

## Current audit

Working baseline:

- Solidity contract, React client, wallet connection
- 17 contract tests, 96 legacy frontend tests, 138 SaaS tests, 54 pgTAP assertions
- Local and Polygon Amoy deployment flow
- Next.js/TypeScript product, magic-link auth, verified claims, org onboarding, dog registry/pedigrees
- Tenant RLS, database entitlements, private storage, audit, quotas, idempotency, transactional outbox
- Stripe checkout/webhooks, billing UI, API keys, versioned REST/OpenAPI, operator/audit views
- Structured redacted logs, request IDs, liveness/readiness, Linux container, runbooks
- CI, dependency automation, fresh-database tests, zero known production npm vulnerabilities

Launch blockers:

- External launch configuration remains: managed host/database, Stripe products, email delivery, telemetry sink/alerts, backups/PITR
- Customer evidence upload/review, invitations, data export/deletion, outbound worker delivery, analytics, and support console remain
- Contract accepts unverified data, has no corrections or transfers, and returns an empty record for unknown IDs
- Dog ID `0` is both a valid first record and documented as the unknown-parent sentinel
- UI is locked to chain `31337`; deployment config is written into source
- Public-chain writes expose every stored field forever
- No staging/production release environments or exercised restore/incident drills yet
- July 2026 dependency baseline remediated for production packages; Hardhat 3 migration remains separate

## Recommended architecture

```text
Browser / mobile
  -> Next.js web app and API boundary
       -> PostgreSQL: users, organizations, dogs, pedigrees, billing, audit
       -> S3-compatible storage: photos and documents
       -> Queue/worker: email, indexing, exports, webhooks
       -> Stripe: checkout, portal, subscriptions, entitlements
       -> Email provider: verification and lifecycle messages
       -> OpenTelemetry/Sentry: traces, logs, errors, alerts
       -> RPC provider
            -> PedigreePal V2 attestations on Polygon
            -> indexer reconciles events into PostgreSQL
```

Recommended implementation:

- Web/BFF: Next.js App Router, strict TypeScript
- Data: managed PostgreSQL, typed migrations/query layer, tenant-scoped repositories
- Identity: email/OAuth accounts plus optional EIP-4361 wallet linking
- Tenancy: organizations, memberships, roles (`owner`, `admin`, `member`, `viewer`)
- Billing: Stripe subscriptions; webhook-derived entitlements; idempotent handlers
- Async: durable queue, transactional outbox, retry/dead-letter policy
- Files: private object storage, signed URLs, malware/type/size checks
- API: versioned REST/OpenAPI, API keys, quotas, signed outbound webhooks
- Chain: V2 hash attestations, role-controlled issuers, ownership transfers, pause/migration plan
- Delivery: preview, staging, production; protected migrations; rollback and restore drills

Next.js keeps the first production topology small and supports Node or Docker deployment. Split a dedicated API/worker only when workload or team boundaries justify it.

## Core data model

- `users`, `accounts`, `sessions`, `wallets`
- `organizations`, `memberships`, `invitations`
- `dogs`, `dog_parents`, `ownerships`, `registrations`
- `documents`, `verifications`, `attestations`
- `subscriptions`, `entitlements`, `usage_counters`
- `api_keys`, `webhook_endpoints`, `webhook_deliveries`
- `audit_events`, `outbox_events`, `idempotency_keys`

Every tenant-owned row carries `organization_id`. Access is enforced in application policy and PostgreSQL row-level security. Audit events are append-only.

## Product capabilities

### Customer

- Landing, pricing, legal, status, contact
- Signup, verification, recovery, MFA-ready sessions
- Personal/team workspaces, invites, RBAC
- Dog registry, pedigree graph, search, import/export
- Evidence uploads, review workflow, public certificate and QR
- Ownership claim/transfer, corrections, full history
- Checkout, trial, plan changes, invoices, cancellation
- Notifications and preference center

### Operator

- Admin console with support impersonation controls
- User/org/subscription/search tools
- Verification queue and fraud/risk flags
- Feature flags, announcements, usage and revenue views
- Audit log, job replay, webhook replay, data export/deletion

### Platform

- API keys, rate limits, quotas, idempotency, webhooks
- Structured logs, traces, metrics, error tracking, uptime checks
- Backups, point-in-time restore, retention, disaster recovery
- CI/CD, dependency updates, secret scanning, SAST, contract analysis
- Load, accessibility, browser, integration, and smart-contract tests

## Delivery phases

### 0. Stabilize

- CI, dependency automation, supported runtimes, security policy
- Fix critical/high exploitable dependencies
- Freeze V1 contract; reconcile docs and behavior
- Threat model, architecture decisions, staging environment

Exit: reproducible green checks; no known critical production exposure.

### 1. SaaS core

- Next.js/TypeScript app shell
- PostgreSQL schema, migrations, seed data
- Accounts, organizations, invitations, RBAC, audit log
- Off-chain dog CRUD, pedigree validation, files, search

Exit: authenticated tenant isolation proven by integration tests.

### 2. Monetization and operations

- Stripe products, checkout, portal, webhooks, entitlements
- Email, onboarding, admin/support console, product analytics
- Jobs, outbox, idempotency, rate limits

Exit: test-clock billing lifecycle and support workflows pass end-to-end.

### 3. Trust layer

- V2 contract specification, tests, static analysis, independent audit
- SIWE wallet linking, issuer roles, attestation/indexer/reconciliation
- Ownership transfers, public verification pages and QR certificates

Exit: reorg-safe indexing and disaster replay tested on testnet.

### 4. Launch readiness

- Staging/prod CI/CD, observability, alerts, status page
- Backup restore, incident, key-rotation, chain-pause, and rollback drills
- Privacy/terms/retention/deletion flows; accessibility and load testing
- Private beta, measured SLOs, launch checklist

Exit: signed launch review; runbooks tested by someone other than author.

## Initial SLOs

- Web/API availability: 99.9% monthly
- Read API p95: under 400 ms excluding third parties
- Background event processing: 99% under 60 seconds
- RPO: 15 minutes; RTO: 4 hours
- Critical alert acknowledgment: 15 minutes

## Approved defaults

- Initial buyer: breeders and kennel organizations
- Plans: B2B organization subscriptions
- Blockchain: optional verification proof, not the primary database or UX
- Infrastructure: managed, low-operations stack
- Initial market and data residency: United States
- Migration: greenfield; no production contract or data
- License: GPL-3.0-only
