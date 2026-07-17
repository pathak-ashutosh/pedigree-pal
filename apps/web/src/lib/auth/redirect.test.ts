import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("accepts an internal path", () => {
    expect(safeNextPath("/dashboard/dogs?status=active")).toBe("/dashboard/dogs?status=active");
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example"])(
    "replaces unsafe value %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/dashboard");
    },
  );
});
