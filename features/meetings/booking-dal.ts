import "server-only";
import { timezoneForCountry } from "@/content/timezones";
import { decodeBytea } from "@/lib/bytea";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { Booking, BookingChoice, BookingEvent, BookingEventKind, BookingGuest, BookingStatus } from "./contract";

// Reading meetings for the calendars and a lead's page: always as the signed-in user, so RLS decides who sees
// which meeting and its history.

const LIST_LIMIT = 200;

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
