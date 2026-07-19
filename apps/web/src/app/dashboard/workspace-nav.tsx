"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type WorkspaceNavItem = {
  label: string;
  /** Absent for a destination that exists in the map but cannot be opened yet. */
  href?: string;
  /** Why it cannot be opened — shown to the user, not just as a tooltip. */
  note?: string;
  /** Overview matches only itself; sections also own their child routes. */
  exact?: boolean;
};

export function isActiveNavPath(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) {
    return true;
  }

  return !exact && pathname.startsWith(`${href}/`);
}

export function WorkspaceNav({ items }: { items: WorkspaceNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace">
      {items.map((item) =>
        item.href ? (
          <Link
            aria-current={isActiveNavPath(pathname, item.href, item.exact) ? "page" : undefined}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        ) : (
          <span aria-disabled="true" key={item.label}>
            {item.label}
            {item.note ? <small>{item.note}</small> : null}
          </span>
        ),
      )}
    </nav>
  );
}
