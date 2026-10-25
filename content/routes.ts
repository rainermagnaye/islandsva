// Every page path, defined once. Nav, footer, links, sitemap, robots and the auth proxy derive from here.

/** Public marketing pages — static, listed in the sitemap. */
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
} as const;

/** Sign-in and portal pages — per-user, never indexed (disallowed in robots.txt). */
export const appRoutes = {
  login: "/login",
  forgotPassword: "/forgot-password",
  setPassword: "/set-password",
  mfa: "/mfa",
  authConfirm: "/auth/confirm",
  acceptInvite: "/accept-invite",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  client: "/client",
  clientDemo: "/client/demo",
  va: "/va",
  vaClients: "/va/clients",
  vaCalendar: "/va/calendar",
  closer: "/closer",
  closerNewClient: "/closer/clients/new",
  admin: "/admin",
  adminLeads: "/admin/leads",
  adminClients: "/admin/clients",
  adminUsers: "/admin/users",
} as const;

export type RoutePath = (typeof routes)[keyof typeof routes];
export type AppRoutePath = (typeof appRoutes)[keyof typeof appRoutes];

/** Contact page with a package preselected in the form. */
export function contactHref(packageSlug?: string) {
  return packageSlug ? `${routes.contact}?package=${encodeURIComponent(packageSlug)}` : routes.contact;
}

/** One lead in the admin system. Lead ids are random UUIDs, so the URL carries no personal data. */
export const adminLeadHref = (id: string) => `${appRoutes.adminLeads}/${id}`;

/** One staff profile. The id is a random UUID, so the URL carries no personal data. */
export const adminUserHref = (id: string) => `${appRoutes.adminUsers}/${id}`;

/** One client profile. The id is a random UUID, so the URL carries no personal data. */
export const adminClientHref = (id: string) => `${appRoutes.adminClients}/${id}`;

/** A client's onboarding form. The token is the secret: this URL goes only into their email (and the Closer's copy). */
export const onboardingHref = (token: string) => `${appRoutes.onboarding}/${token}`;

/** A Closer's view of one of their clients. The id is a random UUID, so the URL carries no personal data. */
export const closerClientHref = (id: string) => `${appRoutes.closer}/clients/${id}`;
