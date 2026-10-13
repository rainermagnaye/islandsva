// Every page path, defined once. Nav, footer, links, sitemap and robots all derive from here.
export const routes = {
  home: "/",
  packages: "/packages",
  pricing: "/pricing",
  testimonials: "/testimonials",
  brands: "/brands",
  about: "/about",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  login: "/login",
} as const;

export type RoutePath = (typeof routes)[keyof typeof routes];

/** Kept out of the sitemap and disallowed in robots.txt (their metadata also sets `robots: { index: false }`). */
export const unlistedRoutes: readonly RoutePath[] = [routes.login];

/** Contact page with a package preselected in the form. */
export function contactHref(packageSlug?: string) {
  return packageSlug ? `${routes.contact}?package=${encodeURIComponent(packageSlug)}` : routes.contact;
}
