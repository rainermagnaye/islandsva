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
export const loginPath = "/login";
export const setPasswordPath = "/set-password";
export const dashboardPath = "/dashboard";

export const appRoutes = {
  login: loginPath,
  forgotPassword: "/forgot-password",
  setPassword: setPasswordPath,
  mfa: "/mfa",
  authConfirm: "/auth/confirm",
  acceptInvite: "/accept-invite",
  dashboard: dashboardPath,
  client: "/client",
  clientDemo: "/client/demo",
  va: "/va",
  vaClients: "/va/clients",
  vaCalendar: "/va/calendar",
  closer: "/closer",
  closerNewClient: "/closer/clients/new",
  admin: "/admin",
  /** Public registration packet. The token is the access; the customer does not sign in. */
  register: "/register",
  adminLeads: "/admin/leads",
  adminClients: "/admin/clients",
  adminDemos: "/admin/demos",
  adminUsers: "/admin/users",
  adminSettings: "/admin/settings",
  /** The signed-in person's own profile. Separate from a staff record in Teams. */
  profile: "/profile",
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


/** A Closer's view of one of their clients. The id is a random UUID, so the URL carries no personal data. */
export const closerClientHref = (id: string) => `${appRoutes.closer}/clients/${id}`;

/** The payment file on a client. The id is a random UUID. */
export const adminClientPaymentHref = (id: string) => `${adminClientHref(id)}/payment`;

/** One registration packet. The token is unguessable and is not an id. */
export const registrationHref = (token: string) => `${appRoutes.register}/${token}`;
