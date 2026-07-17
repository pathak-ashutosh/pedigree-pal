import { organizationInputSchema, suggestOrganizationSlug } from "./organizations";

describe("organization input", () => {
  it("normalizes valid names and slugs", () => {
    expect(organizationInputSchema.parse({ name: "  Northstar  ", slug: "  North-Star " })).toEqual({
      name: "Northstar",
      slug: "north-star",
    });
  });

  it.each(["spaces are invalid", "-leading", "trailing-", "double--dash", "unsafe_underscore"])(
    "rejects unsafe slug %s",
    (slug) => {
      expect(organizationInputSchema.safeParse({ name: "Valid Name", slug }).success).toBe(false);
    },
  );

  it("suggests a stable URL slug", () => {
    expect(suggestOrganizationSlug("  Élite & Northstar Kennels  ")).toBe("elite-northstar-kennels");
    expect(suggestOrganizationSlug("***")).toBe("");
  });
});
