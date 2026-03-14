# Contributing to PedigreePal

Thanks for your interest in contributing. This guide covers the development workflow and project conventions.

## Development Setup

Follow the [Getting Started](README.md#getting-started) section in the README to set up your local environment.

## Workflow

1. Fork the repo and create a branch from `dev`:
   ```bash
   git checkout -b feat/your-feature dev
   ```
2. Make changes, write tests where applicable
3. Run the test suite:
   ```bash
   npx hardhat test
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
- Run the dev server (`cd frontend && npm start`) to verify UI changes

## Code Style

- Solidity: follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- JavaScript/JSX: 2-space indent, single quotes, no semicolons preferred

## Reporting Issues

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/MetaMask version (for frontend bugs)
- Network and transaction hash (for contract bugs)
