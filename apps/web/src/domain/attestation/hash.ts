import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalize } from "./canonical";
import { RECORD_SCHEMA_VERSION, toCanonicalRecord, type AttestableDog } from "./record";

export const SALT_BYTES = 32;

/** Binds every hash to this application and preimage layout. */
const DOMAIN_TAG = keccak_256(utf8ToBytes("pedigreepal.attestation.v1"));

export class AttestationHashError extends Error {
  constructor(
    public readonly code: "INVALID_SALT",
    message: string,
  ) {
    super(message);
    this.name = "AttestationHashError";
  }
}

export function generateSalt(): string {
  return bytesToHex(randomBytes(SALT_BYTES));
}

function parseSalt(salt: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/.test(salt)) {
    throw new AttestationHashError(
      "INVALID_SALT",
      `Salt must be ${SALT_BYTES} bytes of lowercase hex.`,
    );
  }

  return hexToBytes(salt);
}

/**
 * `keccak256(domainTag ‖ schemaVersion ‖ salt ‖ canonicalRecord)`, hex without `0x`
 * to match the other hash columns.
 *
 * Every field ahead of the record is fixed-width, so the variable-length tail cannot
 * be shifted to forge a colliding preimage. keccak256 (not NIST SHA-3) so Phase 3b
 * can verify the same bytes on an EVM chain.
 */
export function hashRecord(dog: AttestableDog, salt: string): string {
  const record = utf8ToBytes(canonicalize(toCanonicalRecord(dog)));
  const schemaVersion = new Uint8Array([
    (RECORD_SCHEMA_VERSION >> 8) & 0xff,
    RECORD_SCHEMA_VERSION & 0xff,
  ]);

  const preimage = new Uint8Array(
    DOMAIN_TAG.length + schemaVersion.length + SALT_BYTES + record.length,
  );
  let offset = 0;
  for (const part of [DOMAIN_TAG, schemaVersion, parseSalt(salt), record]) {
    preimage.set(part, offset);
    offset += part.length;
  }

  return bytesToHex(keccak_256(preimage));
}
