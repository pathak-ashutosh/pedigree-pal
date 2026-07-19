import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: { value: "/dashboard/northstar" } }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname.value }));

import { isActiveNavPath, WorkspaceNav, type WorkspaceNavItem } from "./workspace-nav";

const basePath = "/dashboard/northstar";
const items: WorkspaceNavItem[] = [
  { label: "Overview", href: basePath, exact: true },
  { label: "Dogs", href: `${basePath}/dogs` },
  { label: "Pedigrees", note: "Soon" },
  { label: "Audit log", href: `${basePath}/audit` },
];

function renderAt(pathname: string) {
  mocks.pathname.value = pathname;
  return render(<WorkspaceNav items={items} />);
}

describe("isActiveNavPath", () => {
  it("matches a section and the routes nested under it", () => {
    expect(isActiveNavPath("/dashboard/n/dogs", "/dashboard/n/dogs")).toBe(true);
    expect(isActiveNavPath("/dashboard/n/dogs/abc", "/dashboard/n/dogs")).toBe(true);
    expect(isActiveNavPath("/dashboard/n/dogs/abc/edit", "/dashboard/n/dogs")).toBe(true);
  });

  it("keeps the overview from claiming every page", () => {
    expect(isActiveNavPath("/dashboard/n", "/dashboard/n", true)).toBe(true);
    expect(isActiveNavPath("/dashboard/n/dogs", "/dashboard/n", true)).toBe(false);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    expect(isActiveNavPath("/dashboard/n/dogshow", "/dashboard/n/dogs")).toBe(false);
  });
});

describe("WorkspaceNav", () => {
  it("marks only the current section", () => {
    renderAt(`${basePath}/dogs`);
    expect(screen.getByRole("link", { name: "Dogs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Audit log" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the section marked on a nested record page", () => {
    renderAt(`${basePath}/dogs/20000000-0000-4000-8000-000000000001`);
    expect(screen.getByRole("link", { name: "Dogs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("marks the overview only on the overview itself", () => {
    renderAt(basePath);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dogs" })).not.toHaveAttribute("aria-current");
  });

  it("renders unavailable destinations as disabled, not as links", () => {
    renderAt(basePath);
    expect(screen.queryByRole("link", { name: /Pedigrees/ })).toBeNull();
    const pedigrees = screen.getByText("Pedigrees").closest("span");
    expect(pedigrees).toHaveAttribute("aria-disabled", "true");
    expect(pedigrees).toHaveTextContent("Soon");
  });
});
