export const organizationRoles = ["owner", "admin", "member", "viewer"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const permissions = [
  "organization:read",
  "organization:manage",
  "members:manage",
  "dogs:read",
  "dogs:write",
  "dogs:delete",
  "dogs:attest",
  "audit:read",
] as const;
export type Permission = (typeof permissions)[number];

const rolePermissions: Record<OrganizationRole, ReadonlySet<Permission>> = {
  owner: new Set(permissions),
  admin: new Set([
    "organization:read",
    "organization:manage",
    "members:manage",
    "dogs:read",
    "dogs:write",
    "dogs:delete",
    "dogs:attest",
    "audit:read",
  ]),
  member: new Set(["organization:read", "dogs:read", "dogs:write"]),
  viewer: new Set(["organization:read", "dogs:read"]),
};

export function can(role: OrganizationRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
