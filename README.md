# PedigreePal

Multi-tenant pedigree records for breeders and kennel organizations, with private evidence, traceable stewardship, and optional public blockchain proof.

PedigreePal is becoming a production SaaS. PostgreSQL is operational truth; blockchain is an optional trust layer and never stores private customer data.

## Current foundation

- Next.js 16, React 19, strict TypeScript SaaS application
- Supabase magic-link authentication and verified server claims
- Organizations with owner/admin/member/viewer RBAC
- Tenant-isolated dogs, pedigrees, documents, billing state, and audit events
- Organization onboarding, registry CRUD/search, pedigree validation, billing, and operator views
- Scoped hashed API keys, versioned dog API, atomic quotas, and durable transactional outbox
- PostgreSQL constraints, row-level security, private storage policies
- Retry-safe Stripe checkout/webhooks and database-enforced entitlements
- Structured JSON logs with tested redaction, request IDs, liveness, and readiness APIs
- Standalone container image, production builds, dependency automation, security policy
- Coverage-gated unit/component tests, pgTAP RLS tests, database lint

Current progress and next steps: [status](docs/status.md). See also [SaaS blueprint](docs/saas-blueprint.md), [architecture](docs/architecture.md), [testing](docs/testing.md), and [observability](docs/observability.md).

## Repository

```text
apps/web/       production SaaS web/BFF
contracts/      Foundry project: V2 attestation registry (Phase 3)
supabase/       migrations, RLS/storage policies, pgTAP tests
docs/           architecture and operating standards
```

## Requirements

- Node.js 20–24 and npm 10+
- Docker for local Supabase/database tests
- Supabase CLI 2.109.1 (CI pins it)
- Foundry (`forge`) for `contracts/` — dependencies are git submodules, so clone with `--recurse-submodules`

## Run locally

```bash
npm ci --prefix apps/web
cp apps/web/.env.example apps/web/.env.local
supabase start
```

`supabase start` boots the local stack (Postgres, auth, storage, mail catcher) and applies every migration in `supabase/migrations`. It prints the values `.env.local` needs — `supabase status` reprints them later:

| `.env.local` key | `supabase status` field |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | not from Supabase — use `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | `API URL` (`http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` (or legacy `ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `SECRET_KEY` (or legacy `SERVICE_ROLE_KEY`) |

Leave every value unquoted and on one line. A trailing `# comment` after `KEY=` parses as an empty value, and the app fails fast with a `ZodError` naming the offending variable.

`.env.local` takes precedence over `.env`, so a half-filled `.env.local` shadows working values in `.env`. The `STRIPE_*` keys are only needed for billing flows; omit them locally and any values in `.env` apply.

```bash
npm --prefix apps/web run dev
```

Open `http://localhost:3000` and sign in with any email address — nothing is actually delivered, so read the magic link in the Mailpit web UI at `http://127.0.0.1:54324`. Onboarding creates an organization with trial entitlements, after which the registry is fully usable. Probes are `GET /api/health` and `GET /api/ready`.

Restart `next dev` after editing env files, and re-run `supabase start` after editing `supabase/config.toml`.

Useful afterwards: `supabase db reset` re-applies migrations from scratch; `supabase stop` shuts the stack down.

## Release gate

```bash
npm run check
supabase test db
supabase db lint --local --level warning
npm audit --prefix apps/web --omit=dev --audit-level=high
```

CI runs SaaS UI, fresh-database, RLS, lint, build, and production dependency gates independently.

Production deployment, incident, backup/restore, and billing replay procedures live in [docs/deployment.md](docs/deployment.md) and [docs/runbooks](docs/runbooks).

## Blockchain

Blockchain is an optional, planned trust layer (Phase 3 in the [SaaS blueprint](docs/saas-blueprint.md)): tamper-evident hash attestations only, never private customer data. It is not part of the current system — the retired V1 wallet dApp and Solidity contract have been removed in favor of a fresh V2 attestation design. See the [trust layer plan](docs/trust-layer-plan.md).

## Security

Never commit secrets, Supabase service-role keys, private keys, customer records, evidence, session data, or raw provider payloads. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Contributing

Use `dev` as the integration branch and run the full release gate. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

GPL-3.0-only — see [LICENSE](LICENSE).
