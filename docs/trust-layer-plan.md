# Trust layer plan (Phase 3)

Status: approved direction. Implements the Phase 3 "trust layer" from the [SaaS blueprint](saas-blueprint.md). Nothing here is built yet; PostgreSQL remains the operational source of truth throughout.

## Goal

A certificate holder can prove, without trusting PedigreePal's servers, that:

1. this exact record was attested by a PedigreePal issuer at time T,
2. it has not been altered since, and
3. it has not been revoked.

Verification uses only public data. No private data is ever written on-chain.

## Decisions

- Chain: **Base** (OP-stack L2). Ethereum-inherited security, sub-cent fees, negligible practical reorg risk, and the largest active EVM developer community. Testnet: Base Sepolia. Polygon PoS remains a fallback; the contract is chain-agnostic EVM.
- Contract tooling: **Foundry** (forge/anvil/cast). New Foundry project lands under `contracts/` in Phase 3b.
- Contract lifecycle: **immutable + versioned**, no upgradeable proxy. Attestations are append-only facts; breaking changes ship as a new registry version and old attestations stay valid.
- Key custody: **Turnkey** signer service (policy-gated API signing, free tier, no key material in app processes). AWS KMS is the fallback if a hyperscaler is preferred.
- Hashing scope: **whole-record hash in v1**. Field-level selective disclosure is deferred to Phase 3d; the hash spec is versioned so it can be added without breaking existing attestations.
- Trigger: attest when a record is **finalized/verified**; material edits create a new record version and a new attestation; corrections and fraud use **revocation**.

## Cryptographic design

- `recordHash = keccak256(domainSep ‖ schemaVersion ‖ salt ‖ canonicalRecord)`
- Canonical serialization is byte-deterministic (RFC 8785 JCS or fixed typed field order) and versioned; schema changes must never silently change hashes.
- Per-record random salt, stored off-chain. Prevents brute-forcing low-entropy fields and unlinkability breaks without the certificate.
- Merkle batching: pending record hashes accumulate into a Merkle tree; one transaction attests the root. Per-record proofs are stored off-chain. One tx covers thousands of records.
- Verifier: recompute record hash → check Merkle proof → root → read on-chain attestation (issuer, timestamp, not revoked) → confirm issuer address. All pass ⇒ verified.

## Registry contract (V2)

Minimal attestation registry, small audit surface:

- `attest(bytes32 root)` — `ISSUER_ROLE` only; emits `Attested(root, issuer, timestamp)`
- `revoke(bytes32 root)` — `REVOKER_ROLE` only; emits `Revoked`
- `mapping(bytes32 => {uint40 attestedAt; bool revoked})` so anyone verifies without an indexer
- OpenZeppelin `AccessControl` + `Pausable` (chain-pause runbook)

`REVOKER_ROLE` is separate from `ISSUER_ROLE` (review finding, 2026-07-18). Revocation is permanent — a revoked root can never be re-attested — so if the automated submitter's key also held it, a leaked key could destroy every legitimate root during the incident `pause` is meant to contain. Pause blocks `attest` but not `revoke`, so the operator can still clear forged roots mid-incident; that is only safe because the compromised issuer key cannot revoke. Never grant both roles to one key.

Gate before mainnet: Foundry tests, Slither, independent audit.

## Custody and signing

The platform is the attester. Issuer keys hold `ISSUER_ROLE` and live in Turnkey; the app never touches key material. A small submitter service requests signatures by policy. Multiple issuer keys supported; rotation = add key, remove role from old, revoke anything forged, pause as break-glass. A leaked issuer key is the top risk in the threat model.

## Write path

Reuses existing primitives (`outbox_events`, `idempotency_keys`):

1. Record finalization inserts `attestations(status=pending, record_hash, salt)` and `outbox_events(topic='attestation.requested')` in the same transaction.
2. Batcher worker drains requests on a size/time window, builds the Merkle tree, writes `attestation_batches` + per-record proofs.
3. Submitter worker signs `attest(root)` via Turnkey, submits through the RPC provider, manages nonce/gas bumping serialized per issuer key, records the tx hash. Idempotent.

## Indexer and reorg safety

- Poll `eth_getLogs` for `Attested`/`Revoked` with a persisted block cursor; reconcile into PostgreSQL (`status=confirmed`, block, tx, timestamp).
- Confirmations threshold before final; on cursor block-hash mismatch, roll back and re-index the range.
- Disaster replay: attestation state must be rebuildable from the contract's deploy block alone. Tested on testnet before mainnet.

## Verification UX

- Public unauthenticated route `/verify/[token]` showing the record's attestation status.
- The page verifies client-side against a public RPC endpoint, not the PedigreePal backend — a skeptic need not trust us at all.
- Proof bundle: self-contained JSON (record fields, salt, Merkle proof, contract/root refs), verifiable offline; published spec plus a standalone verifier script.
- QR certificate for physical breeder→buyer handoff.

## Privacy and legal

- On-chain data is limited to salted hashes and Merkle roots. No PII, dog data, or identities.
- GDPR erasure vs immutability: deleting the off-chain record and salt renders the on-chain hash an unlinkable, non-invertible blob (crypto-shredding). Documented policy.
- Honest framing: an attestation proves PedigreePal asserted the record at time T — not that parentage is biologically true. Ground truth (e.g., DNA results) is off-chain evidence.

## Data model additions

- `attestations`: record id/version, `record_hash`, `salt`, batch id, proof, status, block/tx refs
- `attestation_batches`: `merkle_root`, tx hash, block, issuer address, confirmations, status
- `issuer_keys`: address, custody ref, role, status
- Phase 3d: `wallet_links` (SIWE/EIP-4361 organization wallet linking)

## Phases

### 3a. Off-chain integrity (no chain)

Canonical-hash library, versioned spec, `attestations` table; hashes computed and stored on finalize. Gains internal tamper-detection immediately and freezes the hash spec.

Exit: hashes deterministic across runs; spec versioned and tested; regression tests on canonicalization.

### 3b. Testnet attestation

Foundry registry contract on Base Sepolia, Turnkey signer, batcher/submitter/indexer workers, reorg and disaster-replay tests.

Exit: real records attested on testnet; replay from deploy block reproduces state; blueprint exit bar met.

### 3c. Mainnet and certificates

Independent audit → deploy to Base mainnet → public `/verify` page, proof bundles, QR certificates, published verifier spec.

Exit: end-to-end third-party verification with no PedigreePal dependency.

### 3d. Advanced

Field-level selective disclosure (per-field Merkle leaves), SIWE wallet linking, ownership-transfer attestations, revocation UX, third-party verifier SDK.

## Operations

Dashboards/alerts: oldest pending attestation, submission failures, reorg events, issuer gas balance, indexer lag. Runbooks: chain-pause, key rotation, reorg recovery, disaster replay.
