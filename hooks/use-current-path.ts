import { usePathname } from "next/navigation";

/** How a link relates to the page being shown. */
export type CurrentPath = "page" | "section" | undefined;

/**
 * "page" when `pathname` is `href` itself; "section" when it's a page below it (`/admin/leads/…` under
 * `/admin/leads`), unless `exact`; otherwise undefined. Pure, so it's tested without a browser.
 */
export function currentPath(pathname: string, href: string, exact = false): CurrentPath {
  if (pathname === href) return "page";
  if (!exact && pathname.startsWith(`${href}/`)) return "section";
  return undefined;
}

/**
 * Where a nav link stands relative to the current URL — the one rule for marking the current page or
 * section, shared by the site nav and the admin sidebar. Pair with `aria-current`: "page" for the page
 * itself, "true" for a section.
 */
export function useCurrentPath(href: string, { exact = false }: { exact?: boolean } = {}): CurrentPath {
  return currentPath(usePathname(), href, exact);
}
