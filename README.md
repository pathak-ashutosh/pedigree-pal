# PedigreePal

> A blockchain-based decentralized dog pedigree and ownership verification system.

PedigreePal is an Ethereum dApp that lets dog owners, breeders, veterinarians, and animal shelters register and verify dog pedigree information on-chain — creating a transparent, immutable, and accessible registry that replaces costly kennel club registrations.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Local Development](#local-development)
  - [Testnet Deployment](#testnet-deployment)
- [Usage](#usage)
- [Smart Contract](#smart-contract)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Traditional dog pedigree registrations are expensive, centralized, and susceptible to falsification. PedigreePal solves this by storing pedigree data on the blockchain — making records public, tamper-proof, and accessible to anyone with a Web3 wallet.

**Problem:**
- Kennel club registration is costly and geographically limited
- Pedigree documents can be forged by unethical breeders
- No universal, accessible system ties microchip IDs to verifiable ancestry

**Solution:**
- On-chain dog registry with immutable records
- Parent-child relationships stored as a pedigree chain
- Owner address recorded for each dog — enabling vets and shelters to contact owners

---

## Features

- **Register Dogs** — Record name, breed, age, sex, and parentage on-chain
- **Pedigree Lookup** — Retrieve any dog's certificate by ID
- **Ownership Proof** — Each dog is tied to an Ethereum address
- **Parent Linking** — Connect dogs to their mother and father by ID
- **MetaMask Integration** — Wallet-based authentication, no accounts needed
- **Transaction Feedback** — Real-time status for pending and failed transactions

---

## Architecture

```
┌─────────────────────────────────────────┐
│              User Browser               │
│   React dApp (Vite + Tailwind/DaisyUI)  │
│         ethers.js (Web3 layer)          │
└──────────────┬──────────────────────────┘
               │ JSON-RPC
               ▼
┌─────────────────────────────────────────┐
│            MetaMask Wallet              │
│     Signs transactions / manages keys   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Ethereum / Polygon Network      │
│    PedigreePal.sol (Solidity ^0.8)      │
│    Dog registry stored in mapping       │
└─────────────────────────────────────────┘
```

**Data flow:**
1. User connects MetaMask wallet
2. Frontend initializes ethers.js provider + contract instance
3. User submits registration form → frontend calls `registerDog()` on contract
4. MetaMask prompts user to sign and send transaction
5. On confirmation, `Register` event emitted, UI shows success toast
6. Lookup queries `retrieveDog(id)` — a read-only call, no gas needed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity ^0.8, Hardhat |
| Web3 | ethers.js v6 |
| Frontend | React 18, Vite |
| Styling | Tailwind CSS v4, DaisyUI v5 |
| Icons | Lucide React |
| Testnet | Polygon Amoy (via Alchemy) |
| Wallet | MetaMask |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) browser extension
- [Alchemy](https://alchemy.com/) account (for testnet deployment only)

### Installation

```bash
# Clone the repository
git clone https://github.com/pathak-ashutosh/pedigree-pal.git
cd pedigree-pal

# Install smart contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

```env
# .env
API_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
METAMASK_PRIVATE_KEY=your_private_key_without_0x_prefix
```

> **Security:** Never commit your `.env` file or expose your private key. The `.env` file is already in `.gitignore`.

### Local Development

Run the full stack locally using Hardhat's built-in network:

```bash
# Terminal 1 — start local Ethereum node
npx hardhat node

# Terminal 2 — compile and deploy contract to local node
npx hardhat run scripts/deploy.js --network localhost

# Terminal 3 — start the frontend dev server
cd frontend
npm start
```

The dApp will be available at `http://localhost:5173`.

**Configure MetaMask for local development:**
1. Add a new network in MetaMask:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
2. Import one of the accounts printed by `npx hardhat node` using its private key

### Testnet Deployment

Deploy to Polygon Amoy testnet:

```bash
npx hardhat run scripts/deploy.js --network amoy
```

After deployment, update `frontend/src/contracts/contract-address.json` with the new address.

Get Amoy testnet MATIC from the [Polygon Faucet](https://faucet.polygon.technology/).

---

## Usage

### Registering a Dog

1. Open the dApp and click **Connect Wallet**
2. Approve the MetaMask connection prompt
3. Click **Register Dog** and fill in:
   - Name, breed, age, sex
   - Mother ID and Father ID (use `0` if unknown)
4. Submit — MetaMask will prompt for transaction approval
5. Wait for confirmation; a success notification will appear with the new dog's ID

### Looking Up a Dog

1. Click **Check Dog**
2. Enter the dog's ID
3. The pedigree certificate will display: name, breed, age, sex, owner address, and parent IDs

### Tracing a Pedigree

Use the parent IDs on any dog's certificate to recursively look up ancestors by their IDs.

---

## Smart Contract

**Contract:** `PedigreePal.sol`
**Deployed (Hardhat Local):** `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### Dog Struct

```solidity
struct Dog {
    uint id;        // Auto-incremented unique ID
    string name;    // Dog's name
    uint age;       // Age in years
    string breed;   // Breed name
    string sex;     // "M" or "F"
    uint mother;    // Mother's dog ID (0 = unknown)
    uint father;    // Father's dog ID (0 = unknown)
    address owner;  // Ethereum address of the registrant
}
```

### Key Functions

| Function | Description | Access |
|---|---|---|
| `registerDog(name, age, breed, sex, mother, father)` | Register a new dog, returns new dog ID | Public |
| `retrieveDog(id)` | Returns the Dog struct for a given ID | Public view |

### Events

```solidity
event Register(uint id, string name, address owner);
```

Emitted on every successful registration.

### ABI

The compiled ABI is at `frontend/src/contracts/PedigreePal.json`. It is auto-generated by Hardhat on compilation and copied to the frontend by the deploy script.

---

## Project Structure

```
pedigree-pal/
├── contracts/
│   └── PedigreePal.sol          # Main smart contract
├── scripts/
│   └── deploy.js                # Hardhat deployment script
├── test/
│   └── PedigreePal.js           # Contract unit tests
├── frontend/
│   ├── public/                  # Static assets (favicon, logos)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dapp.jsx         # Root app component, state management
│   │   │   ├── RegisterDog.jsx  # Dog registration form
│   │   │   ├── CheckDog.jsx     # Pedigree lookup UI
│   │   │   ├── DogCertificateCard.jsx  # Pedigree display card
│   │   │   ├── ConnectWallet.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── ...              # Status/error message components
│   │   ├── contracts/
│   │   │   ├── PedigreePal.json # Contract ABI (generated)
│   │   │   └── contract-address.json   # Deployed address
│   │   ├── index.jsx            # App entry point
│   │   └── index.css            # Tailwind + DaisyUI theme
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── hardhat.config.js
├── .env.example
└── package.json
```

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to your fork: `git push origin feat/your-feature`
5. Open a pull request against `main`

Please run tests before submitting:

```bash
npx hardhat test
```

---

## Roadmap

- [ ] Encrypt sensitive owner data — only authorized addresses can decrypt
- [ ] Role-based access (breeders, vets, shelters) via contract roles
- [ ] Microchip ID integration
- [ ] IPFS photo storage for dog profiles
- [ ] Multi-chain support (Ethereum mainnet, Polygon mainnet)
- [ ] Mobile-friendly PWA

---

## License

MIT — see [LICENSE](LICENSE).
