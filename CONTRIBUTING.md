# Contributing to PedigreePal

Thanks for your interest in contributing. This guide covers the development workflow and project conventions.

## Development Setup

Follow the [Getting Started](README.md#getting-started) section in the README to set up your local environment.

## Workflow

1. Fork the repo and create a branch from `dev`:
   ```bash
   git checkout -b feat/your-feature dev
   ```
2. Make changes and add regression tests
3. Run the release gate:
   ```bash
   npm run check
   ```
4. Open a PR targeting `dev` (not `main`)

## Branch Naming

| Type | Prefix | Example |
|---|---|---|
| Feature | `feat/` | `feat/microchip-integration` |
| Bug fix | `fix/` | `fix/register-dog-overflow` |
| Docs | `docs/` | `docs/api-reference` |
| Refactor | `refactor/` | `refactor/billing-webhooks` |

## Commit Messages

Use short, imperative messages:
```
feat: add role-based access for vets
fix: prevent duplicate dog IDs
docs: update API reference
```

## SaaS Changes

- Keep business rules in `apps/web/src/domain`; keep provider access at server boundaries
- Verify auth with server claims; enforce tenant access again with PostgreSQL RLS
- Add structured events through the server logger; never log identity, session, dog, or evidence data
- Test every success, denial, and provider-failure path; preserve per-file coverage gates
- Run `npm --prefix apps/web run check`

## Database Changes

- Add forward-only migrations under `supabase/migrations`
- Enable RLS on every exposed table and add behavioral pgTAP tenant tests
- Run `supabase db start`, `supabase test db`, and `supabase db lint --local --level warning`
- Never change production schema through the dashboard without capturing a reviewed migration

## Code Style

- TypeScript/React: follow the existing file style; keep ESLint clean (`npm --prefix apps/web run lint`)

## Reporting Issues

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Environment (browser, OS) and any relevant request IDs from the structured logs
