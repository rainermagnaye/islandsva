import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { BookingChoice } from "./contract";
import type { VaMeetingInput } from "./validation";

// Meetings a VA books from their calendar, written as the signed-in VA. create_va_meeting checks the VA is open,
// the client is on their active assignment and the guests are staff of this agency (supabase/CLAUDE.md).

const VA_REFUSAL: Record<string, string> = {
  IVA01: "That meeting no longer exists, or someone else booked it. Refresh the page.",
  IVA30: "End the meeting after it starts, within 8 hours. A cancelled meeting can't change.",
  IVA31: "Invite staff from this agency only.",
  IVA33: "Invite at most 20 people.",
  IVA38: "Choose a start time that hasn't passed yet.",
  IVA46: "Choose one of your clients.",
  "42501": "Your account can't book meetings right now. Contact us if this keeps happening.",
};

function settle(error: { code?: string; message: string } | null, what: string) {
  if (!error) return { ok: true as const };
  const message = VA_REFUSAL[error.code ?? ""];
  if (message) return { ok: false as const, message };
  throw new UpstreamError("supabase", `${what} failed: ${error.message}`, { cause: error });
}

export async function insertVaMeeting(input: VaMeetingInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_va_meeting", {
    title: input.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    client_id: input.clientId,
    staff_ids: input.staffIds,
    note: input.note || null,
  });
  return settle(error, "Creating a VA meeting");
}

export async function cancelVaMeetingRow(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_va_meeting", { meeting_id: meetingId });
  return settle(error, "Cancelling a VA meeting");
}

/**
 * The agency's other staff (admins, Lead Gens, VAs), for a VA's team meeting. Secret key: RLS lets a VA read only
 * their own profile and roles. Called only after requireRole(["va"]); it returns names and ids only, in the VA's
 * own tenant, without anyone deactivated.
 */
export async function listVaTeam(vaId: string): Promise<BookingChoice[]> {
  if (!isUuid(vaId)) return [];
  const admin = createAdminClient();
  const me = await admin.from("profiles").select("tenant_id").eq("id", vaId).maybeSingle();
  if (me.error) throw new UpstreamError("supabase", `Reading the VA's agency failed (${me.error.code})`);
  if (!me.data?.tenant_id) return [];
  const roles = await admin.from("roles").select("user_id").in("role", ["va", "closer", "admin"]);
  if (roles.error) throw new UpstreamError("supabase", `Listing staff roles failed (${roles.error.code})`);
  const ids = [...new Set((roles.data ?? []).map((row) => row.user_id))].filter((id) => id !== vaId);
  if (ids.length === 0) return [];
  const people = await admin.from("profiles").select("id, full_name").in("id", ids).eq("tenant_id", me.data.tenant_id).neq("status", "inactive");
  if (people.error) throw new UpstreamError("supabase", `Listing staff failed (${people.error.code})`);
  return (people.data ?? [])
    .map((row) => ({ id: row.id, label: row.full_name?.trim() || "Staff" }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
