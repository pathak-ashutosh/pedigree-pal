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
| Docs | `docs/` | `docs/contract-api` |
| Refactor | `refactor/` | `refactor/dapp-state` |

## Commit Messages

Use short, imperative messages:
```
feat: add role-based access for vets
fix: prevent duplicate dog IDs
docs: update contract ABI reference
```

## Smart Contract Changes

- Write or update tests in `test/PedigreePal.js` for any contract change
- Run `npx hardhat compile` to regenerate artifacts before testing
- Document new functions in [docs/smart-contract.md](docs/smart-contract.md)

## Frontend Changes

- Keep components small and focused
- State management lives in `Dapp.jsx` via `useReducer`
- Use DaisyUI components where possible before writing custom CSS
- Use the structured logger; never call `console.*` directly or log customer/wallet data
- Preserve the coverage thresholds in [docs/testing.md](docs/testing.md)
- Run the dev server (`cd frontend && npm start`) to verify UI changes

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

- Solidity: follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- JavaScript/JSX: follow the existing file style; automated formatting will be added during TypeScript migration

## Reporting Issues

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/MetaMask version (for frontend bugs)
- Network and transaction hash (for contract bugs)
