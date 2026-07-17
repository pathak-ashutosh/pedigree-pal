import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/server/logger", () => ({
  logger: { info: mocks.info, warn: mocks.warn },
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { initialOrganizationState } from "@/lib/organizations/state";
import { createOrganization } from "./organizations";

function organizationForm(name: string, slug: string): FormData {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("slug", slug);
  return formData;
}

beforeEach(() => vi.clearAllMocks());

describe("organization action", () => {
  it("rejects invalid input before querying", async () => {
    await expect(
      createOrganization(initialOrganizationState, organizationForm("x", "unsafe slug")),
    ).resolves.toMatchObject({ status: "error", errors: expect.any(Object) });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns a specific duplicate-slug failure", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
    });

    await expect(
      createOrganization(initialOrganizationState, organizationForm("Northstar", "northstar")),
    ).resolves.toEqual({ status: "error", message: "That workspace URL is already taken." });
    expect(mocks.warn).toHaveBeenCalledWith(
      { event: "organization.create_failed", errorCode: "23505" },
      "organization creation failed",
    );
  });

  it("returns a safe generic provider failure", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      createOrganization(initialOrganizationState, organizationForm("Northstar", "northstar")),
    ).resolves.toEqual({
      status: "error",
      message: "We could not create the workspace. Try again shortly.",
    });
  });

  it("creates through the guarded RPC and redirects", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { slug: "northstar" }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(
      createOrganization(initialOrganizationState, organizationForm(" Northstar ", "Northstar")),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rpc).toHaveBeenCalledWith("create_organization", {
      organization_name: "Northstar",
      organization_slug: "northstar",
    });
    expect(mocks.info).toHaveBeenCalledWith(
      { event: "organization.created" },
      "organization created",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/northstar");
  });
});
