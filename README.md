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
- Coverage-gated unit/component/contract tests, pgTAP RLS tests, database lint
- Tested legacy Solidity/Vite dApp retained during migration

See [SaaS blueprint](docs/saas-blueprint.md), [architecture](docs/architecture.md), [testing](docs/testing.md), and [observability](docs/observability.md).

## Repository

```text
apps/web/       production SaaS web/BFF
supabase/       migrations, RLS/storage policies, pgTAP tests
frontend/       legacy V1 wallet dApp
contracts/      legacy V1 Solidity contract
test/           Solidity tests
docs/           architecture and operating standards
```

## Requirements

- Node.js 20–24 and npm 10+
- Docker for local Supabase/database tests
- Supabase CLI 2.109.1 (CI pins it)
- MetaMask only for legacy V1 development

## Setup

```bash
npm ci
npm ci --prefix frontend
npm ci --prefix apps/web
cp apps/web/.env.example apps/web/.env.local
```

Start the local SaaS services and copy the API URL/publishable key from `supabase status` into `apps/web/.env.local`:

```bash
supabase start
npm --prefix apps/web run dev
```

Open `http://localhost:3000`. Probes are `GET /api/health` and `GET /api/ready`.

## Release gate

```bash
npm run check
supabase test db
supabase db lint --local --level warning
npm audit --omit=dev --audit-level=high
npm audit --prefix frontend --omit=dev --audit-level=high
npm audit --prefix apps/web --omit=dev --audit-level=high
```

CI runs contract, legacy UI, SaaS UI, fresh-database, RLS, lint, build, and production dependency gates independently.

Production deployment, incident, backup/restore, and billing replay procedures live in [docs/deployment.md](docs/deployment.md) and [docs/runbooks](docs/runbooks).

## Legacy V1 dApp

The legacy dApp remains for compatibility and contract migration work:

```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
npm --prefix frontend start
```

It runs at `http://localhost:5173`. V1 public-chain records are not the SaaS source of truth. See [smart contract notes](docs/smart-contract.md).

## Security

Never commit secrets, Supabase service-role keys, private keys, customer records, evidence, session data, or raw provider payloads. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Contributing

Use `dev` as the integration branch and run the full release gate. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

GPL-3.0-only — see [LICENSE](LICENSE).
