# PedigreePal SaaS web

Next.js 16/TypeScript customer application. PostgreSQL/Supabase is operational truth; blockchain is optional proof.

## Local setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Required Supabase values come from `supabase status` locally or the hosted project settings.

## Gate

```bash
npm run check
```

Runs warning-free lint, strict typecheck, coverage-enforced tests, and a production build. Runtime dependencies must pass `npm audit --omit=dev --audit-level=high`.

## Boundaries

- `src/domain`: provider-independent business rules
- `src/lib/auth`: claim verification and redirect safety
- `src/lib/supabase`: browser/server/Proxy clients
- `src/lib/server`: JSON logging and request correlation
- `src/app`: public, auth, dashboard, and API routes
- `../../supabase`: schema, RLS, storage policies, pgTAP tests

License: GPL-3.0-only.
