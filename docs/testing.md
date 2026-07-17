# Testing strategy

`npm run check` is the local release gate. CI splits it for fast ownership and diagnosis.

## Layers

- SaaS unit/component: domain invariants, RBAC, env validation, redirects, redaction, API keys/quotas, billing idempotency/webhooks, probes, and UI
- PostgreSQL: fresh migration apply, pgTAP schema/RLS/entitlement/outbox behavior, `plpgsql_check` lint
- Browser smoke: real Chromium render, navigation, responsive layout, console errors, accessibility snapshot
- Security: runtime dependency audit, secret-safe provider failure tests, container build; no live RPC, payments, or production services in tests

## Coverage gates

- SaaS web per file: 90% statements/lines/functions, 85% branches

Untested critical source is included explicitly. Async Server Components are verified by production builds and browser/integration tests because Vitest does not execute them reliably.

## Commands

```bash
npm run check
npm run test:coverage
supabase db start
npm run test:database
supabase db lint --local --level warning
```

Tests must be deterministic, isolated, warning-free, and regression-first: every escaped defect gets a failing test before its fix.
