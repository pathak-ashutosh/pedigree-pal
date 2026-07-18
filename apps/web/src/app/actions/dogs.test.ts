import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrganizationAccess: vi.fn(),
  adminRpc: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/organizations/dal", () => ({
  getOrganizationAccess: mocks.getOrganizationAccess,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.adminRpc }),
}));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: mocks.info, warn: mocks.warn },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { initialDogState } from "@/lib/dogs/state";
import { archiveDog, createDog, finalizeDogRecord, setDogParent, updateDog } from "./dogs";

const organizationId = "10000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";
const childId = "20000000-0000-4000-8000-000000000001";
const parentId = "20000000-0000-4000-8000-000000000002";

type Query = Record<string, ReturnType<typeof vi.fn>>;

function queryBuilder({
  single = { data: null, error: null },
  maybeSingle = { data: null, error: null },
}: {
  single?: unknown;
  maybeSingle?: unknown;
} = {}): Query {
  const query: Query = {};
  for (const method of ["insert", "update", "select", "eq", "neq", "order", "limit", "ilike", "lt"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn().mockResolvedValue(single);
  query.maybeSingle = vi.fn().mockResolvedValue(maybeSingle);
  query.in = vi.fn(() => query);
  return query;
}

function setAccess(role: "owner" | "admin" | "member" | "viewer", queries: Query[]) {
  const from = vi.fn();
  queries.forEach((query) => from.mockReturnValueOnce(query));
  mocks.getOrganizationAccess.mockResolvedValue({
    id: organizationId,
    name: "Northstar",
    slug: "northstar",
    role,
    userId,
    supabase: { from },
  });
  return from;
}

function dogForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    organizationSlug: "northstar",
    dogId: childId,
    registeredName: "Northstar Juniper",
    callName: "June",
    breed: "Golden Retriever",
    sex: "female",
    birthDate: "2024-01-15",
    microchip: "",
    notes: "Private note",
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

function parentForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    organizationSlug: "northstar",
    childId,
    parentId,
    kind: "sire",
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

beforeEach(() => vi.clearAllMocks());

describe("createDog", () => {
  it("denies viewers", async () => {
    setAccess("viewer", []);
    await expect(createDog(initialDogState, dogForm())).resolves.toEqual({
      status: "error",
      message: "You do not have permission to add dogs.",
    });
  });

  it("returns input validation safely", async () => {
    setAccess("member", []);
    await expect(createDog(initialDogState, dogForm({ sex: "invalid" }))).resolves.toMatchObject({
      status: "error",
      message: "Check the highlighted dog fields.",
    });
  });

  it("returns duplicate microchip failures", async () => {
    const query = queryBuilder({ single: { data: null, error: { code: "23505" } } });
    setAccess("member", [query]);
    await expect(createDog(initialDogState, dogForm())).resolves.toEqual({
      status: "error",
      message: "That microchip is already registered in this workspace.",
    });
  });

  it("returns a generic empty-provider failure", async () => {
    const query = queryBuilder({ single: { data: null, error: null } });
    setAccess("member", [query]);
    await expect(createDog(initialDogState, dogForm())).resolves.toEqual({
      status: "error",
      message: "We could not create the dog record. Try again shortly.",
    });
  });

  it("creates a private tenant record and redirects", async () => {
    const query = queryBuilder({ single: { data: { id: childId }, error: null } });
    setAccess("member", [query]);

    await expect(createDog(initialDogState, dogForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: organizationId,
        registered_name: "Northstar Juniper",
        microchip_hash: null,
        created_by: userId,
      }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith(`/dashboard/northstar/dogs/${childId}`);
  });
});

describe("updateDog", () => {
  it("rejects invalid IDs and denied roles", async () => {
    await expect(updateDog(initialDogState, dogForm({ dogId: "bad" }))).resolves.toMatchObject({
      status: "error",
      message: /ID is invalid/i,
    });
    setAccess("viewer", []);
    await expect(updateDog(initialDogState, dogForm())).resolves.toMatchObject({
      status: "error",
      message: /permission to edit/i,
    });
  });

  it("does not erase an existing fingerprint when the field is blank", async () => {
    const query = queryBuilder({ maybeSingle: { data: { id: childId }, error: null } });
    setAccess("member", [query]);

    await expect(updateDog(initialDogState, dogForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(query.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ microchip_hash: expect.anything() }),
    );
  });

  it("returns safe validation and missing-record failures", async () => {
    setAccess("member", []);
    await expect(updateDog(initialDogState, dogForm({ birthDate: "2999-01-01" }))).resolves.toMatchObject({
      status: "error",
      message: /future/i,
    });

    const query = queryBuilder({ maybeSingle: { data: null, error: null } });
    setAccess("member", [query]);
    await expect(updateDog(initialDogState, dogForm())).resolves.toEqual({
      status: "error",
      message: "We could not update the dog record.",
    });
  });

  it("fingerprints a replacement and returns duplicate failures", async () => {
    const query = queryBuilder({ maybeSingle: { data: null, error: { code: "23505" } } });
    setAccess("member", [query]);

    await expect(
      updateDog(initialDogState, dogForm({ microchip: "985-141-000-123-456" })),
    ).resolves.toEqual({
      status: "error",
      message: "That microchip is already registered in this workspace.",
    });
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ microchip_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    );
  });
});

describe("setDogParent", () => {
  const validDogs = [
    {
      id: childId,
      organization_id: organizationId,
      sex: "female",
      birth_date: "2024-01-15",
    },
    {
      id: parentId,
      organization_id: organizationId,
      sex: "male",
      birth_date: "2020-01-15",
    },
  ];

  it("rejects malformed choices and denied roles", async () => {
    await expect(setDogParent(initialDogState, parentForm({ parentId: "bad" }))).resolves.toMatchObject({
      status: "error",
      message: /valid parent/i,
    });
    setAccess("viewer", []);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /permission to edit pedigrees/i,
    });
  });

  it("handles missing and invalid parent records", async () => {
    const failedLookup = queryBuilder();
    failedLookup.in.mockResolvedValue({ data: null, error: { code: "provider_error" } });
    setAccess("member", [failedLookup]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /unavailable/i,
    });

    const missing = queryBuilder();
    missing.in.mockResolvedValue({ data: [validDogs[0]], error: null });
    setAccess("member", [missing]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /unavailable/i,
    });

    const wrongSex = queryBuilder();
    wrongSex.in.mockResolvedValue({
      data: [validDogs[0], { ...validDogs[1], sex: "female" }],
      error: null,
    });
    setAccess("member", [wrongSex]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /sire must be male/i,
    });

    const duplicatedParent = queryBuilder();
    duplicatedParent.in.mockResolvedValue({ data: [validDogs[1], validDogs[1]], error: null });
    setAccess("member", [duplicatedParent]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /unavailable/i,
    });
  });

  it("returns lookup and mutation provider failures", async () => {
    const lookup = queryBuilder();
    lookup.in.mockResolvedValue({ data: validDogs, error: null });
    const existingFailure = queryBuilder({
      maybeSingle: { data: null, error: { code: "provider_error" } },
    });
    setAccess("member", [lookup, existingFailure]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /inspect the pedigree/i,
    });

    const secondLookup = queryBuilder();
    secondLookup.in.mockResolvedValue({ data: validDogs, error: null });
    const noExisting = queryBuilder({ maybeSingle: { data: null, error: null } });
    const mutation = queryBuilder({ maybeSingle: { data: null, error: { code: "write_failed" } } });
    setAccess("member", [secondLookup, noExisting, mutation]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({
      status: "error",
      message: /could not save/i,
    });
  });

  it("inserts and updates validated links", async () => {
    const insertLookup = queryBuilder();
    insertLookup.in.mockResolvedValue({ data: validDogs, error: null });
    const noExisting = queryBuilder({ maybeSingle: { data: null, error: null } });
    const insertMutation = queryBuilder({ maybeSingle: { data: { child_id: childId }, error: null } });
    setAccess("member", [insertLookup, noExisting, insertMutation]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toEqual({
      status: "saved",
      message: "Sire saved.",
    });
    expect(insertMutation.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: parentId, kind: "sire" }),
    );

    const updateLookup = queryBuilder();
    updateLookup.in.mockResolvedValue({ data: validDogs, error: null });
    const existing = queryBuilder({ maybeSingle: { data: { child_id: childId }, error: null } });
    const updateMutation = queryBuilder({ maybeSingle: { data: { child_id: childId }, error: null } });
    setAccess("member", [updateLookup, existing, updateMutation]);
    await expect(setDogParent(initialDogState, parentForm())).resolves.toMatchObject({ status: "saved" });
    expect(updateMutation.update).toHaveBeenCalledWith({ parent_id: parentId });

    const damId = "20000000-0000-4000-8000-000000000003";
    const damLookup = queryBuilder();
    damLookup.in.mockResolvedValue({
      data: [validDogs[0], { ...validDogs[1], id: damId, sex: "female" }],
      error: null,
    });
    const noDam = queryBuilder({ maybeSingle: { data: null, error: null } });
    const damMutation = queryBuilder({ maybeSingle: { data: { child_id: childId }, error: null } });
    setAccess("member", [damLookup, noDam, damMutation]);
    await expect(
      setDogParent(initialDogState, parentForm({ parentId: damId, kind: "dam" })),
    ).resolves.toEqual({ status: "saved", message: "Dam saved." });
  });
});

describe("finalizeDogRecord", () => {
  const dogRow = {
    id: childId,
    organization_id: organizationId,
    registered_name: "Northstar Juniper",
    call_name: null,
    breed: "Golden Retriever",
    sex: "female",
    birth_date: "2024-01-15",
    microchip_hash: null,
    record_version: 1,
    updated_at: "2026-07-18T12:00:00.000000+00:00",
  };

  function finalizeQueries(parents: Array<{ kind: string; parent_id: string }> = []) {
    const dogQuery = queryBuilder({ maybeSingle: { data: dogRow, error: null } });
    const parentQuery = Object.assign(queryBuilder(), { data: parents, error: null });
    return [dogQuery, parentQuery];
  }

  it("rejects invalid IDs and non-administrators", async () => {
    await expect(
      finalizeDogRecord(initialDogState, dogForm({ dogId: "bad" })),
    ).resolves.toMatchObject({ message: /ID is invalid/i });
    setAccess("member", []);
    await expect(finalizeDogRecord(initialDogState, dogForm())).resolves.toMatchObject({
      message: /administrators/i,
    });
  });

  it("reports an unavailable record", async () => {
    setAccess("owner", [
      queryBuilder({ maybeSingle: { data: null, error: null } }),
      Object.assign(queryBuilder(), { data: [], error: null }),
    ]);
    await expect(finalizeDogRecord(initialDogState, dogForm())).resolves.toMatchObject({
      status: "error",
      message: /unavailable/i,
    });
  });

  it("hashes the record and finalizes through the service-role function", async () => {
    mocks.adminRpc.mockResolvedValue({ data: null, error: null });
    setAccess("owner", finalizeQueries([{ kind: "sire", parent_id: parentId }]));

    await expect(finalizeDogRecord(initialDogState, dogForm())).resolves.toEqual({
      status: "saved",
      message: "Version 1 finalized and queued for attestation.",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("finalize_dog_record", {
      dog_id: childId,
      acting_user_id: userId,
      record_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      salt: expect.stringMatching(/^[a-f0-9]{64}$/),
      schema_version: 1,
      expected_updated_at: dogRow.updated_at,
      expected_sire_id: parentId,
      expected_dam_id: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/northstar/dogs/${childId}`);
  });

  it("maps guarded-function failures to friendly messages", async () => {
    const cases: Array<[string, RegExp]> = [
      ["record is already finalized", /already finalized/i],
      ["record changed since it was reviewed", /reload and try again/i],
      ["archived records cannot be finalized", /archived records/i],
      ["not authorized to finalize this record", /administrators/i],
      ["unexpected", /could not finalize/i],
    ];
    for (const [providerMessage, expected] of cases) {
      mocks.adminRpc.mockResolvedValue({
        data: null,
        error: { code: "55000", message: providerMessage },
      });
      setAccess("owner", finalizeQueries());
      await expect(finalizeDogRecord(initialDogState, dogForm())).resolves.toMatchObject({
        status: "error",
        message: expected,
      });
    }
  });
});

describe("archiveDog", () => {
  it("rejects invalid IDs and non-administrators", async () => {
    await expect(archiveDog(initialDogState, dogForm({ dogId: "bad" }))).resolves.toMatchObject({
      message: /ID is invalid/i,
    });
    setAccess("member", []);
    await expect(archiveDog(initialDogState, dogForm())).resolves.toMatchObject({
      message: /administrators/i,
    });
  });

  it("returns provider failures", async () => {
    const query = queryBuilder({ maybeSingle: { data: null, error: { code: "provider_error" } } });
    setAccess("admin", [query]);
    await expect(archiveDog(initialDogState, dogForm())).resolves.toMatchObject({
      status: "error",
      message: /could not archive/i,
    });
  });

  it("archives and redirects administrators", async () => {
    const query = queryBuilder({ maybeSingle: { data: { id: childId }, error: null } });
    setAccess("owner", [query]);
    await expect(archiveDog(initialDogState, dogForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(query.update).toHaveBeenCalledWith({ status: "archived", updated_by: userId });
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/northstar/dogs");
  });
});
