# Local Development Guide

## Requirements

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime for Hardhat and Vite |
| npm | 9+ | Package manager |
| MetaMask | Latest | Wallet for signing transactions |
| Git | Any | Version control |

---

## First-Time Setup

### 1. Clone and install

```bash
git clone https://github.com/pathak-ashutosh/pedigree-pal.git
cd pedigree-pal
npm install
cd frontend && npm install && cd ..
```

### 2. Environment variables

```bash
cp .env.example .env
```

For local development only, you don't need to set `API_URL` or `METAMASK_PRIVATE_KEY` — those are only required for testnet deployment.

### 3. Compile the smart contract

```bash
npx hardhat compile
```

Artifacts are generated in `artifacts/` and the ABI is copied to `frontend/src/contracts/PedigreePal.json` when you run the deploy script.

---

## Running the Stack

Open three terminal windows:

**Terminal 1 — Local Ethereum node**
```bash
npx hardhat node
```
This starts a local JSON-RPC server at `http://127.0.0.1:8545` with 20 pre-funded test accounts. Leave this running.

**Terminal 2 — Deploy contract**
```bash
npx hardhat run scripts/deploy.js --network localhost
```
This compiles the contract, deploys it to the local node, and writes the address to `frontend/src/contracts/contract-address.json`.

> Re-run this every time you restart the Hardhat node, as state does not persist.

**Terminal 3 — Frontend dev server**
```bash
cd frontend
npm start
```
Opens at `http://localhost:5173` with hot module replacement.

---

## MetaMask Setup for Local Dev

1. Open MetaMask → Settings → Networks → Add a network manually:

   | Field | Value |
   |---|---|
   | Network Name | `Hardhat Local` |
   | RPC URL | `http://127.0.0.1:8545` |
   | Chain ID | `31337` |
   | Currency Symbol | `ETH` |

2. Import a test account:
   - Copy one of the private keys printed by `npx hardhat node`
   - MetaMask → Import Account → paste the private key
   - This account has 10,000 test ETH

3. Switch MetaMask to the `Hardhat Local` network before connecting the dApp.

---

## Running Tests

```bash
npx hardhat test
```

Tests live in `test/PedigreePal.js`. The test suite uses Hardhat's built-in testing environment with ethers.js.

To run a specific test file or test:
```bash
npx hardhat test test/PedigreePal.js
```

---

## Common Issues

**"Could not fetch chain ID" in MetaMask**
The Hardhat node isn't running. Start it with `npx hardhat node`.

**"Contract not deployed at address"**
The contract address in `frontend/src/contracts/contract-address.json` doesn't match the current node's deployed contract. Re-run the deploy script.

**Transactions fail with "nonce too high"**
This happens after restarting the Hardhat node while MetaMask retains the old nonce. Fix: MetaMask → Account Settings → Advanced → Reset Account.

**Frontend doesn't detect MetaMask**
Make sure MetaMask is installed and unlocked. The dApp checks for `window.ethereum` on load.

---

## Making Contract Changes

1. Edit `contracts/PedigreePal.sol`
2. Recompile: `npx hardhat compile`
3. Redeploy: `npx hardhat run scripts/deploy.js --network localhost`
4. The deploy script automatically updates the frontend contract address and ABI
5. The frontend dev server will pick up the new files automatically

---

## Building for Production

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. Serve it with any static file host or preview locally:

```bash
npm run preview
```
