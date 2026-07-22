# Deployment

## Artifact

`apps/web/Dockerfile` builds a non-root Next.js standalone image with an HTTP liveness check. CI builds the same artifact. A managed Next.js host is also valid if it preserves stdout JSON and server-only secrets.

## Required production configuration

- Public: app URL, Supabase URL/publishable key
- Server: Supabase service-role key, Stripe secret/webhook secret/price IDs,
  stable base64-encoded 32-byte `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- Operations: `LOG_LEVEL`, immutable `RELEASE_SHA`

Never expose service-role or Stripe values to `NEXT_PUBLIC_*`.
`NEXT_PUBLIC_APP_URL` is the canonical security boundary: use one HTTPS origin,
with no path. Requests for other hosts are rejected.

Before production traffic:

1. Allow only the exact canonical callback URL in Supabase Auth; remove preview
   and wildcard redirect URLs.
2. Enable Supabase Auth CAPTCHA and rate limits for magic-link requests.
3. Put API and auth routes behind host-level DDoS/rate-limit controls.
4. Require phishing-resistant MFA for Supabase, Stripe, hosting, DNS, and GitHub.
5. Use managed secrets, database PITR, encrypted backups, and tested restores.
6. Keep production logs free of request bodies, credentials, and personal data.

## Release order

1. Confirm CI, dependency audits, backup/PITR, and staging smoke are green.
2. Apply reviewed forward-compatible migrations. Never edit production schema through a dashboard.
3. Deploy the immutable image with `RELEASE_SHA` set to the commit.
4. Require `/api/health` for liveness and `/api/ready` for traffic readiness.
5. Verify login, tenant isolation, a read-only API call, Stripe test event, logs, and alerts.
6. Monitor error rate, p95 latency, billing webhook failures, and oldest pending outbox event.

Rollback application code to the prior image. Do not reverse a migration unless a reviewed down migration is proven safe; prefer roll-forward fixes.

## Environments

Use separate Supabase and Stripe projects for preview/staging/production. Production branch protection requires CI, review, and migration approval. Rotate secrets after staff/vendor access changes.

## Free-tier deployment (Vercel Hobby + Supabase Free)

For demos, portfolios, and pre-revenue MVPs. Cost: $0.

**Caveat:** Vercel Hobby is non-commercial only — processing real payments (live Stripe) violates its terms. Keep Stripe in test mode here, or move `apps/web` to a commercial-friendly host (Vercel Pro, or a Render free web service) pointed at the same Supabase project.

### Stack

- `apps/web` → Vercel Hobby. Vercel uses its native Next.js build; the `Dockerfile` and `output: "standalone"` are ignored (harmless).
- `supabase/` → Supabase Free: 500 MB database, 1 GB storage, 2 projects, no backups. Pauses after 7 days with no database queries.
- Stripe → test mode.

### Steps

1. **Supabase:** create a free project. `supabase link --project-ref <ref>`, then `supabase db push` to apply `supabase/migrations`. Copy the project URL and publishable key.
2. **Vercel:** import the GitHub repo and set **Root Directory = `apps/web`**. `apps/web/vercel.json` pins the framework and commands.
3. **Environment variables** (Vercel project settings, from `apps/web/.env.example`):

   | Variable | Scope | Value |
   | --- | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | Public | Deployed URL, e.g. `https://your-app.vercel.app` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service-role key — never `NEXT_PUBLIC_*` |
   | `STRIPE_SECRET_KEY` | Server only | `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | Server only | `whsec_…` from the webhook created in step 4 |
   | `STRIPE_PRICE_STARTER` | Server only | `price_…` |
   | `STRIPE_PRICE_PRO` | Server only | `price_…` |
   | `LOG_LEVEL` | Server only | `info` |
   | `RELEASE_SHA` | Server only | Deploy commit SHA (Vercel exposes `VERCEL_GIT_COMMIT_SHA`) |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Server only | Stable base64-encoded 32-byte key |

4. **Stripe:** add a webhook endpoint at `https://<app-url>/api/v1/webhooks/stripe`, subscribe to the checkout/subscription events the app handles, and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. **Keep Supabase awake:** set repository variable `APP_URL` to the deployed URL. `.github/workflows/keepalive.yml` pings `/api/ready` (a real database query) every 2 days.

### Notes

- The keepalive workflow only runs on schedule from the **default branch** — merge it to `main`. GitHub disables scheduled workflows after 60 days of repository inactivity; a manual `workflow_dispatch` run re-arms it.
- Supabase Free has no backups or PITR — it is not a production system of record.
- Verify after first deploy: `GET /api/health` (liveness) and `GET /api/ready` (database-backed readiness).
