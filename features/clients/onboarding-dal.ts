import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";
import {
  clientBusinessFrom,
  clientBusinessToJson,
  onboardingState,
  type ClientBilling,
  type ClientBusiness,
  type OnboardingInvitation,
  type OnboardingLink,
  type OnboardingStatus,
} from "./contract";

// Onboarding links. Status is read with the signed-in session (RLS: the client's Closer and admins with 2FA).
// Issuing and withdrawing use the secret key: the functions are server-only because they take token hashes,
// and each checks the actor itself. Callers have already checked the session and read the client under RLS.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The latest link and the client's submission and email times, or null when the client isn't visible. */
export async function getOnboardingStatus(clientId: string): Promise<OnboardingStatus | null> {
  if (!UUID.test(clientId)) return null;
  const supabase = await createClient();
  const [client, links] = await Promise.all([
    supabase.from("clients").select("onboarding_submitted_at, registration_email_sent_at").eq("id", clientId).maybeSingle(),
    supabase
      .from("client_onboarding_links")
      .select("created_at, expires_at, submitted_at, revoked_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (client.error) throw new UpstreamError("supabase", `Reading onboarding for ${clientId} failed: ${client.error.message}`, { cause: client.error });
  if (links.error) throw new UpstreamError("supabase", `Reading onboarding links for ${clientId} failed: ${links.error.message}`, { cause: links.error });
  if (!client.data) return null;
  const row = links.data[0];
  const link: OnboardingLink | null = row
    ? { createdAt: row.created_at, expiresAt: row.expires_at, submittedAt: row.submitted_at, revokedAt: row.revoked_at }
    : null;
  const submittedAt = client.data.onboarding_submitted_at;
  return { state: onboardingState(link, submittedAt), link, submittedAt, emailedAt: client.data.registration_email_sent_at };
}

const ISSUE_REFUSALS = { IVA01: "not_found", IVA06: "not_pending", IVA07: "disabled", IVA13: "too_soon", IVA14: "not_allowed" } as const;
export type OnboardingRefusal = (typeof ISSUE_REFUSALS)[keyof typeof ISSUE_REFUSALS];

/** Stores a new link's hash (revoking the open one). Secret key: issue_onboarding_link is server-only. */
export async function issueOnboardingLink(clientId: string, issuedBy: string, tokenHash: string) {
  const { data, error } = await createAdminClient().rpc("issue_onboarding_link", { client_id: clientId, issued_by: issuedBy, token_hash: tokenHash });
  if (error) {
    const refusal = ISSUE_REFUSALS[error.code as keyof typeof ISSUE_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Issuing an onboarding link failed: ${error.message}`, { cause: error });
  }
  const [row] = data;
  if (!row) throw new UpstreamError("supabase", "Issuing an onboarding link returned no row");
  return { ok: true as const, expiresAt: row.link_expires_at };
}

/** Withdraws the open link, if any. Secret key: revoke_onboarding_link is server-only. */
export async function revokeOnboardingLink(clientId: string, revokedBy: string) {
  const { data, error } = await createAdminClient().rpc("revoke_onboarding_link", { client_id: clientId, revoked_by: revokedBy });
  if (error) {
    const refusal = ISSUE_REFUSALS[error.code as keyof typeof ISSUE_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Withdrawing an onboarding link failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, withdrawn: data };
}

/** Records that the mail provider accepted the onboarding email. Secret key: the column is server-only. */
export async function markOnboardingEmailSent(clientId: string) {
  const { error } = await createAdminClient().from("clients").update({ registration_email_sent_at: new Date().toISOString() }).eq("id", clientId);
  if (error) throw new UpstreamError("supabase", `Recording the onboarding email for ${clientId} failed: ${error.message}`, { cause: error });
}

// The public onboarding page and form. The visitor is anonymous, so these use the secret key; the unguessable
// token (looked up by its SHA-256) is the authorization. Only what the form needs is selected.

export type InvitationLookup =
  | { state: "open"; clientId: string; invitation: OnboardingInvitation }
  | { state: "gone" }
  | { state: "unknown" };

/** The client and package behind a link, or why the link no longer works. Viewing never uses the link up. */
export async function getInvitation(tokenHash: string): Promise<InvitationLookup> {
  const admin = createAdminClient();
  const { data: link, error } = await admin
    .from("client_onboarding_links")
    .select("client_id, expires_at, submitted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading an onboarding link failed: ${error.message}`, { cause: error });
  if (!link) return { state: "unknown" };
  if (link.submitted_at || link.revoked_at || new Date(link.expires_at) <= new Date()) return { state: "gone" };

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("status, disabled_at, company_name, contact_name, contact_email, contact_phone, business, package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone")
    .eq("id", link.client_id)
    .maybeSingle();
  if (clientError) throw new UpstreamError("supabase", `Reading an onboarding client failed: ${clientError.message}`, { cause: clientError });
  if (!client || client.status !== "pending" || client.disabled_at) return { state: "gone" };

  return {
    state: "open",
    clientId: link.client_id,
    invitation: {
      companyName: client.company_name,
      contactName: client.contact_name,
      contactEmail: client.contact_email,
      contactPhone: client.contact_phone,
      business: clientBusinessFrom(client.business),
      packageCode: client.package_code,
      hoursPerWeek: client.hours_per_week,
      termMonths: client.term_months,
      monthlyCents: client.monthly_cents,
      startsOn: client.starts_on,
      timezone: client.timezone,
      expiresAt: link.expires_at,
    },
  };
}

// 23514 is a CHECK violation (details too long for the database): the client can shorten and retry.
const SUBMIT_REFUSALS = { IVA06: "gone", IVA07: "gone", IVA08: "unknown", IVA09: "gone", IVA10: "gone", "23514": "too_large" } as const;

/** Writes the client's details and uses the link up, in one transaction. Secret key: submit_onboarding is server-only. */
export async function submitOnboarding(tokenHash: string, input: { contactName: string; contactPhone: string; business: ClientBusiness; billing: ClientBilling; consent: true }) {
  const { data, error } = await createAdminClient().rpc("submit_onboarding", {
    token_hash: tokenHash,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    business: clientBusinessToJson(input.business),
    billing: { ...input.billing },
    consent: input.consent,
  });
  if (error) {
    const refusal = SUBMIT_REFUSALS[error.code as keyof typeof SUBMIT_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    // Only the code: a Postgres error's details can repeat the client's whole row, which must not reach the logs.
    throw new UpstreamError("supabase", `Submitting onboarding failed (${error.code})`);
  }
  return { ok: true as const, clientId: data };
}

/** The Closer (or admin) who created the client, to tell them the form is in. Secret key: no session here. */
export async function getClientCreator(clientId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("clients").select("company_name, created_by, creator:profiles!clients_created_by_fkey(email, full_name, status)").eq("id", clientId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the client's creator failed: ${error.message}`, { cause: error });
  // Someone who has left gets no email about the client.
  if (!data?.creator || data.creator.status === "inactive") return null;
  const { data: roles, error: rolesError } = await admin.from("roles").select("role").eq("user_id", data.created_by);
  if (rolesError) throw new UpstreamError("supabase", `Reading the creator's roles failed: ${rolesError.message}`, { cause: rolesError });
  return { companyName: data.company_name, email: data.creator.email, name: data.creator.full_name, isCloser: roles.some((r) => r.role === "closer") };
}
