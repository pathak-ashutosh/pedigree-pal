import { can, organizationRoles, permissions } from "./rbac";

describe("role permissions", () => {
  it("gives owners every permission", () => {
    for (const permission of permissions) {
      expect(can("owner", permission)).toBe(true);
    }
  });

  it("prevents members and viewers from administration", () => {
    expect(can("member", "members:manage")).toBe(false);
    expect(can("viewer", "dogs:write")).toBe(false);
    expect(can("viewer", "dogs:read")).toBe(true);
  });

  it("restricts attestation to administrators", () => {
    expect(can("owner", "dogs:attest")).toBe(true);
    expect(can("admin", "dogs:attest")).toBe(true);
    expect(can("member", "dogs:attest")).toBe(false);
    expect(can("viewer", "dogs:attest")).toBe(false);
  });

  it("defines all supported roles", () => {
    expect(organizationRoles).toEqual(["owner", "admin", "member", "viewer"]);
  });
});
