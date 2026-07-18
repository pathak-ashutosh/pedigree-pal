# Project status

Last updated: 2026-07-18.

Living "where we are / resume here" doc. Full roadmap: [saas-blueprint.md](saas-blueprint.md). Phase 3 design: [trust-layer-plan.md](trust-layer-plan.md).

## Phase progress

| Phase | Status |
| --- | --- |
| 0 — Stabilize | ✅ complete — CI green, Dependabot tuned, security policy; V1 dApp/contract/Hardhat removed entirely (not just frozen) |
| 1 — SaaS core | ✅ core complete — app shell, schema/RLS/pgTAP, orgs/RBAC/audit, dog CRUD + pedigree validation |
| 2 — Monetization & ops | 🔶 active — see open items and remaining below |
| 3 — Trust layer | 📝 planned only, nothing built — start with 3a (off-chain hashing) |
| 4 — Launch readiness | ⏳ not started |

## Deployed (free-tier demo)

- App: Vercel — `https://pedigree-pal.vercel.app` (Next.js `apps/web`; Vercel Root Directory = `apps/web`)
- Data/auth/storage: Supabase project `pedigree-pal` (ref `bjlbjvaizmvyrhfejlfg`), core migration applied
- Stripe: test mode
- Keepalive: `.github/workflows/keepalive.yml` pings `/api/ready` every 2 days (needs repo variable `APP_URL` set)

## Open items — resume here

1. **Magic-link redirect goes to `localhost`.** Code hardening done (2026-07-18): `requestMagicLink` now derives the origin from `x-forwarded-proto`/`x-forwarded-host` via `apps/web/src/lib/server/origin.ts`, falling back to `NEXT_PUBLIC_APP_URL` — a missing env var can no longer produce a localhost link once deployed. Vercel already has `NEXT_PUBLIC_APP_URL` in Production (value unverified; latest deploy postdates it). Remaining manual steps: Supabase → Authentication → URL Configuration: **Site URL** = `https://pedigree-pal.vercel.app`, **Redirect URLs** include `https://pedigree-pal.vercel.app/**`; then merge `dev` → `main` to deploy and verify sign-in end-to-end.
2. **Stripe test setup:** create test products/prices, add a webhook to `/api/v1/webhooks/stripe`, set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` in Vercel.
3. **Email:** Supabase's built-in sender is rate-limited (a few/hour) — wire custom SMTP (e.g. Resend free tier) for real sign-in volume.

## Phase 2 remaining

Custom SMTP/email, onboarding polish, admin/support console, product analytics, evidence upload/review, invitations, data export/deletion, outbound worker delivery.

## Held dependency upgrades

`apps/web` intentionally holds these majors (Dependabot ignores set); revisit when upstream catches up:

- **ESLint 10** — `eslint-config-next@16`'s bundled plugins (react, jsx-a11y, import) have no ESLint 10 release yet.
- **TypeScript 7** — the native compiler port breaks `typescript-eslint` (caps at `<6.1.0`), failing the lint step.

Unblocks when Next ships an ESLint-10-ready `eslint-config-next` and `typescript-eslint` adds TS 7 support.

## Suggested next step

Finish the auth redirect + Stripe webhook config so the deployed demo signs in end-to-end. Then either continue Phase 2 (email via Resend, invitations, evidence upload) or start trust-layer **3a** in parallel — it is self-contained (canonical-hash library + `attestations` migration, no chain) and de-risks Phase 3.
