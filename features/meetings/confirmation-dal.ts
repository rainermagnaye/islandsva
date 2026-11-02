import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";

// The visitor's confirmation email (20261101171012_discovery_confirmation_email). Secret key: both functions are
// service_role only, because the stamp is server-only and the visitor's address isn't sent to the browser. The caller
// passes the signed-in user requireRole just checked; claim_discovery_confirmation checks them again.

const CLAIM_REFUSALS = { IVA01: "refused", IVA14: "refused", IVA23: "refused", IVA48: "bad_address" } as const;

export type ConfirmationClaim =
  | { ok: true; call: { email: string; startsAt: string; country: string | null; claimedAt: string } | null }
  | { ok: false; reason: (typeof CLAIM_REFUSALS)[keyof typeof CLAIM_REFUSALS] };

/** Stamps the call's confirmation email for its current start. `call: null` = already sent for this start. */
export async function claimConfirmation(meetingId: string, actorId: string): Promise<ConfirmationClaim> {
  const { data, error } = await createAdminClient().rpc("claim_discovery_confirmation", { meeting_id: meetingId, actor: actorId });
  if (error) {
    const code = error.code ?? "";
    if (Object.hasOwn(CLAIM_REFUSALS, code)) return { ok: false, reason: CLAIM_REFUSALS[code as keyof typeof CLAIM_REFUSALS] };
    // The code only: a constraint's detail can echo row values.
    throw new UpstreamError("supabase", `Claiming a confirmation email for ${meetingId} failed (${error.code})`);
  }
  const row = data?.[0];
  return { ok: true, call: row ? { email: row.email, startsAt: row.starts_at, country: row.country, claimedAt: row.claimed_at } : null };
}

/** Undoes that claim after a failed send, so the Lead Gen can send it again. A later claim is left alone. */
export async function releaseConfirmation(meetingId: string, claimedAt: string) {
  const { error } = await createAdminClient().rpc("release_discovery_confirmation", { meeting_id: meetingId, claimed_at: claimedAt });
  if (error) throw new UpstreamError("supabase", `Releasing a confirmation email for ${meetingId} failed (${error.code})`);
}
