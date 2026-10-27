import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { manilaToIso, type DiscoveryRequest } from "./contract";
import type { BookingInput, BookingNoteInput } from "./validation";

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

const REFUSAL: Record<string, string> = {
  IVA01: "That meeting no longer exists. Refresh the page.",
  IVA30: "End the meeting after it starts, within 8 hours. A cancelled meeting can't be edited.",
  IVA31: "Choose a client or staff member from this agency.",
  IVA32: "That note can't be changed. Refresh the page.",
  IVA33: "Invite at most 20 people.",
  IVA34: "You can complete this once the meeting has started.",
  IVA14: "Only an admin or a lead gen from this agency can change this call.",
  IVA22: "Choose a time on the hour or half hour, from now through the next 14 days.",
  IVA23: "This call can't be changed now. Refresh the page.",
  "23505": "That time was just taken. Choose another.",
  "42501": "You need to be signed in as an admin to change a meeting.",
};

function refused(error: { code?: string; message: string }) {
  return REFUSAL[error.code ?? ""]
    ?? (error.message.includes("attachment") ? "That attachment can't be saved. Use a recording, PDF or image under 2 MB." : null)
    ?? (error.message.includes("note is required") ? "Enter a note." : null);
}

type FileInput = { name: string; type: string; base64: string } | null;

export async function insertBooking(input: BookingInput, file: FileInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_manual_meeting", {
    title: input.title,
    starts_at: manilaToIso(input.startDate, input.startTime),
    ends_at: manilaToIso(input.endDate, input.endTime),
    client_ids: input.clientIds,
    staff_ids: input.staffIds,
    note: input.note || null,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Creating a booking failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function saveBooking(input: BookingInput, meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_manual_meeting", {
    meeting_id: meetingId,
    title: input.title,
    starts_at: manilaToIso(input.startDate, input.startTime),
    ends_at: manilaToIso(input.endDate, input.endTime),
    client_ids: input.clientIds,
    staff_ids: input.staffIds,
  });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Saving a booking failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function cancelBookingRow(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_manual_meeting", { meeting_id: meetingId });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Cancelling a booking failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function completeBookingRow(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_meeting", { meeting_id: meetingId });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Completing a booking failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function updateBookingNote(eventId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_manual_meeting_note", { event_id: eventId, note });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Saving a booking note failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function deleteBookingNote(eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_manual_meeting_note", { event_id: eventId });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Deleting a booking note failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function insertBookingNote(input: BookingNoteInput, file: FileInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_manual_meeting_note", {
    meeting_id: input.meetingId,
    note: input.note,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Saving a booking note failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function confirmDiscovery(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_discovery_booking", { meeting_id: meetingId });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Confirming a discovery call failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

export async function rescheduleDiscovery(meetingId: string, startsAt: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_discovery_booking", { meeting_id: meetingId, starts_at: startsAt });
  if (error) {
    const message = refused(error);
    if (message) return { ok: false as const, message };
    throw new UpstreamError("supabase", `Rescheduling a discovery call failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/** Requested discovery calls a Lead Gen may still decide. The inbox hides the email. */
export async function listDiscoveryInbox(): Promise<DiscoveryRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discovery_inbox");
  if (error) throw new UpstreamError("supabase", `Listing discovery requests failed: ${error.message}`, { cause: error });
  return (data ?? []).map((row) => ({
    meetingId: row.meeting_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    fullName: row.full_name,
    companyName: row.company_name,
  }));
}
