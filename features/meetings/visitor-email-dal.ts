import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";

// The visitor's automatic emails (20261102090000_discovery_acknowledgement). Secret key: the claims are service_role
// only, because the stamps are server-only and run for an anonymous visitor (after the form's honeypot and Turnstile)
// or a scheduled job, with no signed-in user to check.

export type VisitorEmail = { meetingId: string; email: string; startsAt: string; country: string | null };

/** Stamps the acknowledgement for the lead's open request. null = nothing to send (already sent, closed or over a limit). */
export async function claimAcknowledgement(leadId: string): Promise<VisitorEmail | null> {
  const { data, error } = await createAdminClient().rpc("claim_discovery_acknowledgement", { lead_id: leadId });
  // The code only: a constraint's detail can echo row values.
  if (error) throw new UpstreamError("supabase", `Claiming an acknowledgement for ${leadId} failed (${error.code})`);
  const row = data?.[0];
  return row ? { meetingId: row.meeting_id, email: row.email, startsAt: row.starts_at, country: row.country } : null;
}

/** Stamps up to 50 due expiry notices (20261102093000_discovery_expiry) and returns them to send. */
export async function claimExpiryNotices(): Promise<VisitorEmail[]> {
  const { data, error } = await createAdminClient().rpc("claim_expiry_notices");
  if (error) throw new UpstreamError("supabase", `Claiming expiry notices failed (${error.code})`);
  return (data ?? []).map((row) => ({ meetingId: row.meeting_id, email: row.email, startsAt: row.starts_at, country: row.country }));
}
