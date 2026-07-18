# Record hash spec

Version: **1** (`RECORD_SCHEMA_VERSION = 1`). Status: frozen.

Defines how a PedigreePal dog record becomes the 32-byte hash that Phase 3b attests on-chain. Implementation: [`apps/web/src/domain/attestation`](../apps/web/src/domain/attestation). Design context: [trust-layer-plan.md](trust-layer-plan.md).

Anything in this document is part of the wire format. Changing it invalidates every stored hash, so changes ship as a new version rather than an edit — see [Versioning](#versioning).

## Preimage

```
recordHash = keccak256( domainTag ‖ schemaVersion ‖ salt ‖ canonicalRecord )
```

| Field | Width | Value |
| --- | --- | --- |
| `domainTag` | 32 bytes | `keccak256("pedigreepal.attestation.v1")` |
| `schemaVersion` | 2 bytes | unsigned big-endian, `1` for this version |
| `salt` | 32 bytes | per-record CSPRNG output, stored off-chain |
| `canonicalRecord` | variable | UTF-8 bytes of the canonical JSON below |

Every fixed-width field precedes the single variable-length field, so no two distinct inputs share a preimage by shifting a boundary.

**keccak256, not SHA3-256.** The two differ in padding. Phase 3b verifies these bytes inside an EVM contract, where `keccak256` is the native hash.

**Salt.** 32 CSPRNG bytes per record. Without it, the record's low-entropy fields (a birth date, a breed) would let anyone confirm a guess against a published hash. The salt is stored in `attestations.salt`, withheld from the `authenticated` column grant, and released only in a proof bundle.

Hashes and salts are lowercase hex without a `0x` prefix, matching the other hash columns in the schema.

## Canonical JSON

[RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785): members sorted by UTF-16 code unit, no insignificant whitespace, ES6 number formatting, `-0` written as `0`. `undefined` members and non-plain objects are rejected rather than coerced, so a typo cannot silently shrink the preimage.

Fields, all required and non-optional (absent values are explicit `null`):

| Field | Type |
| --- | --- |
| `schema` | `"pedigreepal.dog"` |
| `schemaVersion` | integer, `1` |
| `id` | UUID |
| `organizationId` | UUID |
| `version` | integer ≥ 1, `dogs.record_version` at finalize time |
| `registeredName` | string, 1–120 |
| `callName` | string ≤ 80, or null |
| `breed` | string, 1–120 |
| `sex` | `"male"` \| `"female"` \| `"unknown"` |
| `birthDate` | `YYYY-MM-DD` |
| `microchipHash` | 64 lowercase hex, or null |
| `sireId` | UUID, or null |
| `damId` | UUID, or null |

`id` and `organizationId` are included so a hash cannot be replayed against another tenant's record.

### Excluded, deliberately

`status`, `notes`, timestamps, and actor columns. They change without altering what a certificate claims, and including them would invalidate an attestation every time a dog was marked retired or a note was edited.

### Known limitation

Parents are referenced by id, so a v1 hash commits to *which* dogs were named as sire and dam, not to their contents. A verifier checking ancestry needs those records' own attestations; the proof bundle carries them. Per-field Merkle leaves and selective disclosure are Phase 3d.

## Versioning

`RECORD_SCHEMA_VERSION` is stamped inside the canonical record *and* in the preimage, and persisted per row in `attestations.schema_version`. A new version means: add the new field list, leave the old one in place, and keep verifying old attestations under their recorded version. Old hashes stay valid forever.

The frozen vector in [`hash.test.ts`](../apps/web/src/domain/attestation/hash.test.ts) fails CI if any of this changes by accident. That failure is the signal to cut a new version, not to update the vector.

## Worked example

Record: `id` `1111…1111`, `organizationId` `2222…2222`, `version` 1, `registeredName` "Ashwood Northern Light", `callName` "Nori", `breed` "Bernese Mountain Dog", `sex` female, `birthDate` 2024-03-19, `microchipHash` `bb…bb`, `sireId` `3333…3333`, `damId` `4444…4444`, with salt `aa…aa`:

```
2276a81aae276512842408f98ce2bc8360eb0ac9509b8d74ed6b39cabd35e247
```

## Finalize lifecycle

Hashing runs when an owner or admin **finalizes** a record (`dogs:attest` permission, `registry.write` entitlement). Finalization is a timestamp (`dogs.finalized_at`), deliberately not a `dog_status` value — a finalized dog can still retire or die without touching its attestation.

- `dogs.record_version` starts at 1 and is the `version` this spec hashes. Draft edits never bump it.
- Finalizing calls `finalize_dog_record()` (security definer), which re-checks under a row lock that the record still matches what the caller reviewed (`updated_at`, current sire/dam), then atomically inserts the `attestations` row, enqueues an `attestation.requested` outbox event for Phase 3b batching, and stamps `finalized_at`.
- A **material** edit to a finalized record — any hashed field, including parent links — bumps `record_version` and clears `finalized_at`. The prior attestation stays valid for its version; the new draft awaits re-finalization. Non-material edits (`status`, `notes`) change nothing.
- `record_version` and `finalized_at` are not client-writable; only the function and its triggers set them.

## Storage

`public.attestations` — one row per attested record version, unique on `(dog_id, record_version)` and on `record_hash`. Rows start `pending`; Phase 3b moves them to `confirmed` once a Merkle root lands on-chain. Writes go through `finalize_dog_record()` only: a tenant can read its own hashes but cannot forge or alter them.

Deleting a dog cascades to its attestations. That is the GDPR position — dropping the record and its salt leaves any published hash unlinkable and non-invertible.
