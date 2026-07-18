# Project status

Last updated: 2026-07-18.

Living "where we are / resume here" doc. Full roadmap: [saas-blueprint.md](saas-blueprint.md). Phase 3 design: [trust-layer-plan.md](trust-layer-plan.md), frozen hash format: [record-hash-spec.md](record-hash-spec.md).

## Phase progress

| Phase | Status |
| --- | --- |
| 0 — Stabilize | ✅ complete — CI green, Dependabot tuned, security policy; V1 dApp/contract/Hardhat removed entirely (not just frozen) |
| 1 — SaaS core | ✅ core complete — app shell, schema/RLS/pgTAP, orgs/RBAC/audit, dog CRUD + pedigree validation |
| 2 — Monetization & ops | 🔶 active — see open items and remaining below |
| 3 — Trust layer | 🔶 3a complete on `dev` — hash library, frozen v1 spec, `attestations` table, finalize lifecycle wired end-to-end; next is 3b (testnet) |
| 4 — Launch readiness | ⏳ not started |

## Deployed (free-tier demo)

- App: Vercel — `https://pedigree-pal.vercel.app` (Next.js `apps/web`; Vercel Root Directory = `apps/web`)
- Data/auth/storage: Supabase project `pedigree-pal` (ref `bjlbjvaizmvyrhfejlfg`), core migration applied
- Stripe: test mode
- Keepalive: `.github/workflows/keepalive.yml` pings `/api/ready` every 2 days (needs repo variable `APP_URL` set)

## Open items — resume here

1. **Magic-link redirect goes to `localhost`.** Code hardening done (2026-07-18): `requestMagicLink` derives the origin from `x-forwarded-proto`/`x-forwarded-host` via `apps/web/src/lib/server/origin.ts`, falling back to `NEXT_PUBLIC_APP_URL` — a missing env var can no longer produce a localhost link. Remaining manual step: Supabase → Authentication → URL Configuration: **Site URL** = `https://pedigree-pal.vercel.app`, **Redirect URLs** include `https://pedigree-pal.vercel.app/**`. Then merge to `main` and verify sign-in end-to-end.
2. **Stripe test setup:** products/prices/webhook created; `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` set in Vercel (2026-07-18). Unverified: that `STRIPE_SECRET_KEY` (set 3 days earlier) belongs to the *same sandbox* as the new webhook secret — if it does not, signature checks and price lookups fail. Confirm with `curl https://api.stripe.com/v1/prices -u <key>:` and then run one test checkout with `4242 4242 4242 4242`.
3. **Email:** Supabase's built-in sender is rate-limited (a few/hour) — wire custom SMTP (e.g. Resend free tier) for real sign-in volume.
4. **Apply the Phase 3a migrations to the hosted project.** `20260718160000_attestations.sql` and `20260718180000_dog_finalization.sql` are verified locally only; the Supabase project still has just the core migration. Until they are applied, the deployed dog page will error querying `attestations` — apply before (or with) the next `main` deploy.

## Phase 2 remaining

Custom SMTP/email, onboarding polish, admin/support console, product analytics, evidence upload/review, invitations, data export/deletion, outbound worker delivery.

## Held dependency upgrades

`apps/web` intentionally holds these majors (Dependabot ignores set); revisit when upstream catches up:

- **ESLint 10** — `eslint-config-next@16`'s bundled plugins (react, jsx-a11y, import) have no ESLint 10 release yet.
- **TypeScript 7** — the native compiler port breaks `typescript-eslint` (caps at `<6.1.0`), failing the lint step.

Unblocks when Next ships an ESLint-10-ready `eslint-config-next` and `typescript-eslint` adds TS 7 support.

## Phase 3a — what is built

- `apps/web/src/domain/attestation/` — RFC 8785 canonicalization, the frozen v1 record projection, and `keccak256(domainTag ‖ schemaVersion ‖ salt ‖ canonicalRecord)`. 48 tests including a golden vector that fails CI if the format drifts.
- `supabase/migrations/20260718160000_attestations.sql` — `attestations` table, RLS, service-role-only writes, `salt` withheld from the member column grant and from the audit trail.
- `supabase/migrations/20260718180000_dog_finalization.sql` — finalize lifecycle: `dogs.record_version` + `finalized_at` (chosen over a new `dog_status` value — real-world lifecycle is orthogonal to record integrity), `finalize_dog_record()` RPC (owner/admin + `registry.write`, row-locked staleness checks, atomic attestation insert + outbox `attestation.requested` + stamp), material edits and pedigree changes auto-bump the version and clear the marker.
- Finalize action + record-integrity panel on the dog detail page; new `dogs:attest` permission (owner/admin).
- [record-hash-spec.md](record-hash-spec.md) — the frozen wire format and lifecycle.
- Verified end-to-end against a local Supabase: pgTAP covers the lifecycle; a live PostgREST call with the app's exact payload confirmed the RPC seam.

## Suggested next step

Start 3b (Foundry registry contract on Base Sepolia, Turnkey signer, batcher/submitter workers draining `attestation.requested`). In parallel, Phase 2 still needs email via Resend, invitations, and evidence upload.
