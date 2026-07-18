export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

export class CanonicalizationError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_TYPE" | "NON_FINITE_NUMBER" | "CIRCULAR_REFERENCE",
    message: string,
  ) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalizationError(
      "NON_FINITE_NUMBER",
      "NaN and Infinity have no canonical JSON form.",
    );
  }

  return Object.is(value, -0) ? "0" : String(value);
}

function serialize(value: CanonicalValue, ancestors: Set<object>): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeNumber(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new CanonicalizationError(
        "UNSUPPORTED_TYPE",
        `Values of type ${typeof value} cannot be canonicalized.`,
      );
  }

  if (ancestors.has(value)) {
    throw new CanonicalizationError("CIRCULAR_REFERENCE", "Circular references cannot be hashed.");
  }
  const nested = new Set(ancestors).add(value);

  if (Array.isArray(value)) {
    return `[${value.map((entry) => serialize(entry, nested)).join(",")}]`;
  }

  if (!isPlainObject(value)) {
    throw new CanonicalizationError(
      "UNSUPPORTED_TYPE",
      "Only plain objects and arrays can be canonicalized.",
    );
  }

  const record = value as { readonly [key: string]: CanonicalValue };
  const members = Object.keys(record)
    // RFC 8785 orders members by UTF-16 code unit, which is the default string sort.
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key], nested)}`);

  return `{${members.join(",")}}`;
}

/**
 * Serializes a value to RFC 8785 (JSON Canonicalization Scheme) form: sorted
 * members, no insignificant whitespace, ES6 number formatting. `undefined` is
 * rejected rather than dropped so a typo can never silently shrink a hash preimage.
 */
export function canonicalize(value: CanonicalValue): string {
  return serialize(value, new Set());
}
