import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";
import { onboardingState, type OnboardingLink, type OnboardingStatus } from "./contract";

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
