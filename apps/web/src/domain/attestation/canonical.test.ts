import { canonicalize, CanonicalizationError, type CanonicalValue } from "./canonical";

describe("canonicalize", () => {
  it("orders members by UTF-16 code unit regardless of insertion order", () => {
    expect(canonicalize({ b: 1, a: 2, C: 3 })).toBe('{"C":3,"a":2,"b":1}');
    expect(canonicalize({ a: 2, C: 3, b: 1 })).toBe('{"C":3,"a":2,"b":1}');
  });

  it("sorts nested members too", () => {
    expect(canonicalize({ outer: { z: null, a: [3, 1] } })).toBe('{"outer":{"a":[3,1],"z":null}}');
  });

  it("preserves array order", () => {
    expect(canonicalize(["b", "a", "c"])).toBe('["b","a","c"]');
  });

  it("emits no insignificant whitespace", () => {
    expect(canonicalize({ a: [1, 2], b: { c: true } })).toBe('{"a":[1,2],"b":{"c":true}}');
  });

  it("normalizes negative zero", () => {
    expect(canonicalize(-0)).toBe("0");
    expect(canonicalize(0)).toBe("0");
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalize(Number.NaN)).toThrow(CanonicalizationError);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(/canonical JSON form/);
  });

  it("rejects undefined instead of dropping the member", () => {
    expect(() => canonicalize({ a: undefined } as unknown as CanonicalValue)).toThrow(
      /cannot be canonicalized/,
    );
  });

  it("rejects non-plain objects that JSON.stringify would coerce", () => {
    expect(() => canonicalize(new Date(0) as unknown as CanonicalValue)).toThrow(
      /plain objects and arrays/,
    );
  });

  it("rejects circular references rather than recursing forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalize(cyclic as CanonicalValue)).toThrow(/Circular references/);
  });

  it("allows the same object to appear twice on separate branches", () => {
    const shared = { a: 1 };
    expect(canonicalize({ x: shared, y: shared })).toBe('{"x":{"a":1},"y":{"a":1}}');
  });

  it("escapes control characters and quotes per JSON", () => {
    expect(canonicalize({ a: 'line\n"quoted"\ttab' })).toBe('{"a":"line\\n\\"quoted\\"\\ttab"}');
  });

  it("keeps non-ASCII text literal", () => {
    expect(canonicalize({ name: "Bërnèr Sennenhund 犬" })).toBe('{"name":"Bërnèr Sennenhund 犬"}');
  });

  it("escapes lone surrogates so output is always well-formed UTF-8", () => {
    expect(canonicalize({ a: "\ud800" })).toBe('{"a":"\\ud800"}');
  });

  it("canonicalizes an empty object and array", () => {
    expect(canonicalize({})).toBe("{}");
    expect(canonicalize([])).toBe("[]");
  });
});
