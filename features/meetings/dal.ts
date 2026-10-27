import "server-only";
import { timezoneForCountry } from "@/content/timezones";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import { manilaToIso, type Booking, type BookingChoice, type BookingEvent, type BookingEventKind, type BookingGuest, type BookingStatus, type DiscoveryRequest } from "./contract";
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

const LIST_LIMIT = 200;

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

type MeetingListRow = {
  id: string;
  kind: "manual" | "discovery";
  title: string | null;
  lead_id: string | null;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  client_id: string | null;
  client_name: string | null;
  staff_id: string | null;
  staff_name: string | null;
  client_ids: string[] | null;
  staff_ids: string[] | null;
  client_names: string[] | null;
  staff_names: string[] | null;
  creator_name: string | null;
};

function guestsOf(row: MeetingListRow): BookingGuest[] {
  const clients = (row.client_ids ?? []).map((id, index) => ({ id, kind: "client" as const, name: row.client_names?.[index] || row.client_name || "Client" }));
  const staff = (row.staff_ids ?? []).map((id, index) => ({ id, kind: "staff" as const, name: row.staff_names?.[index] || row.staff_name || "Staff" }));
  if (clients.length === 0 && row.client_id && row.client_name) clients.push({ id: row.client_id, kind: "client", name: row.client_name });
  if (staff.length === 0 && row.staff_id && row.staff_name) staff.push({ id: row.staff_id, kind: "staff", name: row.staff_name });
  return [...clients, ...staff];
}

type EventRow = {
  id: string;
  meeting_id: string;
  kind: BookingEventKind;
  body: string | null;
  actor_name: string | null;
  created_at: string;
  attachment_name: string | null;
  attachment_type: string | null;
};

/** Manual bookings the signed-in person may see, newest start first, with their history. */
export function listBookings(): Promise<Booking[]> {
  return loadBookings();
}

/** Every meeting on one lead, including a cancelled discovery call. */
export function listLeadBookings(leadId: string): Promise<Booking[]> {
  if (!isUuid(leadId)) return Promise.resolve([]);
  return loadBookings(leadId);
}

async function loadBookings(leadId?: string): Promise<Booking[]> {
  const supabase = await createClient();
  let query = supabase
    .from("meetings")
    .select("id, kind, title, lead_id, status, starts_at, ends_at, client_id, client_name, staff_id, staff_name, client_ids, staff_ids, client_names, staff_names, creator_name")
    .in("kind", ["manual", "discovery"])
    .in("status", ["requested", "scheduled", "cancelled", "done"])
    .order("starts_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (leadId) query = query.eq("lead_id", leadId);
  const { data, error } = await query;
  if (error) throw new UpstreamError("supabase", `Listing bookings failed: ${error.message}`, { cause: error });
  const rows = (data ?? []) as MeetingListRow[];
  const ids = rows.map((row) => row.id);
  const events = new Map<string, BookingEvent[]>();
  if (ids.length > 0) {
    const history = await supabase
      .from("meeting_events")
      .select("id, meeting_id, kind, body, actor_name, created_at, attachment_name, attachment_type")
      .in("meeting_id", ids)
      .order("created_at", { ascending: true });
    if (history.error) throw new UpstreamError("supabase", `Listing booking history failed: ${history.error.message}`, { cause: history.error });
    for (const event of (history.data ?? []) as EventRow[]) {
      const list = events.get(event.meeting_id) ?? [];
      list.push({
        id: event.id,
        kind: event.kind,
        body: event.body,
        actorName: event.actor_name ?? "Team",
        createdAt: event.created_at,
        attachmentName: event.attachment_name,
        attachmentType: event.attachment_type,
      });
      events.set(event.meeting_id, list);
    }
  }
  const leadIds = rows.flatMap((row) => (row.lead_id ? [row.lead_id] : []));
  const names = new Map<string, { company_name: string | null; full_name: string; country: string | null }>();
  if (leadIds.length > 0) {
    const leads = await supabase.from("leads").select("id, company_name, full_name, country").in("id", leadIds);
    if (leads.error) throw new UpstreamError("supabase", `Listing discovery leads failed: ${leads.error.message}`, { cause: leads.error });
    for (const lead of leads.data ?? []) names.set(lead.id, lead);
  }
  return rows.flatMap((row): Booking[] => {
    const history = events.get(row.id) ?? [];
    if (row.kind === "discovery") {
      if (row.status !== "requested" && row.status !== "scheduled" && row.status !== "done" && !(leadId && row.status === "cancelled")) return [];
      const lead = row.lead_id ? names.get(row.lead_id) : undefined;
      const zone = lead?.country ? timezoneForCountry(lead.country) : null;
      return [{
        id: row.id,
        kind: "discovery" as const,
        title: "Discovery call",
        status: row.status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        leadId: row.lead_id,
        clientId: null,
        clientName: lead?.company_name || lead?.full_name || null,
        staffId: null,
        staffName: null,
        guests: [],
        creatorName: "Website",
        timeZone: zone?.value ?? null,
        timeZoneCity: zone ? zone.label.split(" — ")[1] : null,
        events: history,
      }];
    }
    if (!row.title || (row.status !== "scheduled" && row.status !== "cancelled" && row.status !== "done")) return [];
    return [{
      id: row.id,
      kind: "manual" as const,
      title: row.title,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      leadId: null,
      clientId: row.client_id,
      clientName: row.client_name,
      staffId: row.staff_id,
      staffName: row.staff_name,
      guests: guestsOf(row),
      creatorName: row.creator_name ?? "Admin",
      timeZone: null,
      timeZoneCity: null,
      events: history,
    }];
  });
}

/** Clients and employees an admin can attach to a booking, plus the signed-in admin's name. */
export async function listBookingChoices(userId: string): Promise<{ clients: BookingChoice[]; staff: BookingChoice[]; creatorName: string }> {
  const supabase = await createClient();
  const [clients, roles, me] = await Promise.all([
    supabase.from("clients").select("id, company_name").is("disabled_at", null).order("company_name").limit(LIST_LIMIT),
    supabase.from("roles").select("user_id").in("role", ["va", "closer", "admin"]),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  if (clients.error) throw new UpstreamError("supabase", `Listing clients for a booking failed: ${clients.error.message}`, { cause: clients.error });
  if (roles.error) throw new UpstreamError("supabase", `Listing staff for a booking failed: ${roles.error.message}`, { cause: roles.error });
  if (me.error) throw new UpstreamError("supabase", `Reading the booking creator failed: ${me.error.message}`, { cause: me.error });

  const ids = [...new Set((roles.data ?? []).map((row) => row.user_id))];
  let staff: BookingChoice[] = [];
  if (ids.length > 0) {
    const profiles = await supabase.from("profiles").select("id, full_name, status").in("id", ids).neq("status", "inactive");
    if (profiles.error) throw new UpstreamError("supabase", `Listing staff for a booking failed: ${profiles.error.message}`, { cause: profiles.error });
    staff = (profiles.data ?? [])
      .map((row) => ({ id: row.id, label: row.full_name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return {
    clients: (clients.data ?? []).map((row) => ({ id: row.id, label: row.company_name })),
    staff,
    creatorName: me.data?.full_name || "You",
  };
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

/** One file on a history row the caller is already allowed to read. */
export async function getBookingAttachment(eventId: string) {
  if (!isUuid(eventId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_events")
    .select("attachment_name, attachment_type, attachment_bytes")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading a booking attachment failed: ${error.message}`, { cause: error });
  if (!data?.attachment_name || !data.attachment_type || !data.attachment_bytes) return null;
  return { name: data.attachment_name, type: data.attachment_type, bytes: decodeBytea(data.attachment_bytes) };
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

function decodeBytea(value: string) {
  const hex = value.startsWith("\\x") ? value.slice(2) : /^[0-9a-fA-F]+$/.test(value) ? value : "";
  if (hex && hex.length % 2 === 0) return Uint8Array.from(Buffer.from(hex, "hex"));
  return Uint8Array.from(Buffer.from(value, "base64"));
}
