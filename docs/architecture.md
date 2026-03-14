# Architecture

## System Overview

PedigreePal is a two-layer system:

1. **Smart Contract Layer** — Solidity contract on Ethereum/Polygon storing the dog registry
2. **Frontend dApp** — React application that talks to the contract via ethers.js and MetaMask

```
┌─────────────────────────────────────────────────────┐
│                    User Browser                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │        React dApp (Vite + Tailwind)         │   │
│  │                                             │   │
│  │   Dapp.jsx (state, contract calls)          │   │
│  │   ├── RegisterDog.jsx                       │   │
│  │   ├── CheckDog.jsx                          │   │
│  │   └── DogCertificateCard.jsx                │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │ ethers.js                     │
│  ┌──────────────────▼──────────────────────────┐   │
│  │              MetaMask Extension             │   │
│  │     Signs txns · Manages keys & accounts   │   │
│  └──────────────────┬──────────────────────────┘   │
└─────────────────────┼───────────────────────────────┘
                      │ JSON-RPC
          ┌───────────▼────────────┐
          │  Ethereum/Polygon Node │
          │  (Hardhat local /      │
          │   Polygon Amoy)        │
          │                        │
          │  ┌──────────────────┐  │
          │  │  PedigreePal.sol │  │
          │  │  Dog registry    │  │
          │  └──────────────────┘  │
          └────────────────────────┘
```

---

## Frontend Architecture

### State Management

`Dapp.jsx` owns all application state via a single `useReducer`. The reducer handles:

| Action | Description |
|---|---|
| `CONNECT_WALLET` | Stores provider, signer, contract instance, and user address |
| `REGISTER_DOG` | Triggers registration flow |
| `CHECK_DOG` | Stores retrieved dog data |
| `SET_TRANSACTION_PENDING` | Tracks tx hash while waiting |
| `SET_ERROR` | Captures contract/tx errors |
| `DISMISS_ERROR` | Clears error state |

### Component Tree

```
index.jsx
└── Dapp.jsx
    ├── Navbar.jsx
    ├── NoWalletDetected.jsx        (shown if MetaMask absent)
    ├── ConnectWallet.jsx           (shown before wallet connected)
    ├── NetworkErrorMessage.jsx     (wrong network warning)
    ├── WaitingForTransactionMessage.jsx
    ├── TransactionErrorMessage.jsx
    ├── RegisterDog.jsx             (registration form)
    ├── CheckDog.jsx                (lookup form)
    │   └── DogCertificateCard.jsx  (result display)
    ├── SuccessToast.jsx
    └── Footer.jsx
```

### Web3 Initialization Flow

```
Page Load
  └── Dapp mounts
        └── Check window.ethereum
              ├── Not found → render NoWalletDetected
              └── Found → initialize ethers BrowserProvider
                    └── User clicks "Connect Wallet"
                          └── request accounts (MetaMask prompt)
                                └── get signer → instantiate Contract
                                      └── render main UI
```

### Contract Interaction

All contract calls go through `ethers.Contract`:

```js
// Read (no gas, no tx)
const dog = await contract.retrieveDog(id);

// Write (requires MetaMask signature)
const tx = await contract.registerDog(name, age, breed, sex, mother, father);
await tx.wait();  // wait for on-chain confirmation
```

Events are listened to on the contract instance to update UI after confirmation.

---

## Data Model

```
Dog {
  id      uint     ← auto-incremented, starts at 1
  name    string
  age     uint
  breed   string
  sex     string   ← "M" | "F"
  mother  uint     ← references another Dog.id (0 = unknown)
  father  uint     ← references another Dog.id (0 = unknown)
  owner   address  ← msg.sender at registration time
}
```

Pedigree is represented as a **directed acyclic graph** (DAG) — each dog points to its parents. Consumers traverse the tree by recursively calling `retrieveDog` on parent IDs.

---

## Networks

| Network | Chain ID | Use Case |
|---|---|---|
| Hardhat Local | 31337 | Local development |
| Polygon Amoy | 80002 | Public testnet |

The Hardhat config conditionally includes the Amoy network when `API_URL` and `METAMASK_PRIVATE_KEY` are set in `.env`.

---

## Build & Tooling

| Tool | Role |
|---|---|
| Hardhat | Contract compilation, local node, deployment scripts, testing |
| Vite | Frontend bundler (replaces Create React App) |
| Tailwind CSS v4 | Utility-first styling via Vite plugin |
| DaisyUI v5 | Pre-built component themes (custom "pedigree" theme) |
| dotenv | Environment variable injection for Hardhat config |
