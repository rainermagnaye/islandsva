import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";

// Discovery times are read and written with the signed-in session: RLS lets only an admin with two-factor
// sign-in read them, and set_discovery_times (security invoker) checks the same before it replaces them.

export type DiscoveryTimesRefusal = "not_allowed" | "conflict" | "invalid";

const REFUSALS: Record<string, DiscoveryTimesRefusal> = {
  // insufficient_privilege: not an admin with two-factor sign-in (the session lost aal2).
  "42501": "not_allowed",
  // unique_violation: another admin saved at the same moment.
  "23505": "conflict",
  // check_violation / invalid_datetime_format: a time the form shouldn't have sent.
  "23514": "invalid",
  "22007": "invalid",
};

/** The database refusal as a reason; null means anything else (the caller treats it as an outage). */
export function refusalOf(code: string | undefined): DiscoveryTimesRefusal | null {
  return (code && REFUSALS[code]) || null;
}

/** The agency's discovery times ("09:00", in order) and when they were last saved. */
export async function listDiscoveryTimes(): Promise<{ times: string[]; savedAt: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("discovery_times").select("time_of_day, created_at").order("position");
  if (error) throw new UpstreamError("supabase", `Reading discovery times failed (${error.code})`);
  const savedAt = data.reduce<string | null>((latest, row) => (latest === null || row.created_at > latest ? row.created_at : latest), null);
  return { times: data.map((row) => row.time_of_day.slice(0, 5)), savedAt };
}

/** Replaces the agency's discovery times. A refusal comes back as a reason; anything else throws. */
export async function saveDiscoveryTimes(times: readonly string[]): Promise<{ ok: true } | { ok: false; reason: DiscoveryTimesRefusal }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_discovery_times", { times: [...times] });
  if (!error) return { ok: true };
  const reason = refusalOf(error.code);
  if (reason) return { ok: false, reason };
  throw new UpstreamError("supabase", `Saving discovery times failed (${error.code})`);
}
