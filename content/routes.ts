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
  clientTasks: "/client/tasks",
  clientMatch: "/client/match",
  clientCalendar: "/client/calendar",
  clientVas: "/client/vas",
  clientAssistants: "/client/assistants",
  va: "/va",
  vaClients: "/va/clients",
  vaTasks: "/va/tasks",
  vaHours: "/va/hours",
  vaCalendar: "/va/calendar",
  closer: "/closer",
  closerNewClient: "/closer/clients/new",
  admin: "/admin",
  /** Public registration packet. The token is the access; the customer does not sign in. */
  register: "/register",
  adminLeads: "/admin/leads",
  adminClients: "/admin/clients",
  adminDemos: "/admin/demos",
  adminSales: "/admin/sales",
  adminUsers: "/admin/users",
  adminSettings: "/admin/settings",
  /** The signed-in person's own profile. Separate from an employee record in Teams. */
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

/** One employee profile. The id is a random UUID, so the URL carries no personal data. */
export const adminUserHref = (id: string) => `${appRoutes.adminUsers}/${id}`;

/** One client profile. The id is a random UUID, so the URL carries no personal data. */
export const adminClientHref = (id: string) => `${appRoutes.adminClients}/${id}`;

/** One task. The id is a random UUID, so the URL carries no personal data. */
export const clientTaskHref = (id: string) => `${appRoutes.clientTasks}/${id}`;

/** One file on a task. Both ids are random UUIDs. */
export const clientTaskFileHref = (taskId: string, fileId: string) => `${clientTaskHref(taskId)}/files/${fileId}`;

/** One of the client's virtual assistants. The id is a random UUID, so the URL carries no personal data. */
export const clientVaHref = (id: string) => `${appRoutes.clientVas}/${id}`;
/** One task in the VA portal. The id is a random UUID. */
export const vaTaskHref = (id: string) => `${appRoutes.vaTasks}/${id}`;

/** One file on a task, for the assigned VA. Both ids are random UUIDs. */
export const vaTaskFileHref = (taskId: string, fileId: string) => `${vaTaskHref(taskId)}/files/${fileId}`;


/** A Closer's view of one of their clients. The id is a random UUID, so the URL carries no personal data. */
export const closerClientHref = (id: string) => `${appRoutes.closer}/clients/${id}`;

/** A file on a booking note. The id is a random UUID. */
export const meetingFileHref = (eventId: string) => `/meeting-files/${eventId}`;

/** The payment file on a client. The id is a random UUID. */
export const adminClientPaymentHref = (id: string) => `${adminClientHref(id)}/payment`;

/** One registration packet. The token is unguessable and is not an id. */
export const registrationHref = (token: string) => `${appRoutes.register}/${token}`;
