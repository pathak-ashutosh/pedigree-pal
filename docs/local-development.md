# Local development

## Requirements

- Node.js 20–24, npm 10+
- Docker
- Supabase CLI 2.109.1

## SaaS stack

```bash
npm ci --prefix apps/web
cp apps/web/.env.example apps/web/.env.local
supabase start
supabase status
npm --prefix apps/web run dev
```

Copy the local API URL, publishable key, and service-role key from `supabase status`. Use Stripe test-mode values; forward test webhooks to `/api/v1/webhooks/stripe`.

Run the gate:

```bash
npm --prefix apps/web run check
supabase test db
supabase db lint --local --level warning
```

The app runs at `http://localhost:3000`; liveness and readiness are `/api/health` and `/api/ready`.
