import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { ClientDemo, DemoStatus } from "./contract";

// Bookings: read with the signed-in session (RLS: the client their own, the VA theirs, the Closer their
// clients', admins with 2FA all). Written only through book_demo, decide_demo and cancel_demo, which are
// executable by the secret key alone; each checks the actor itself, and callers have already checked the session.

export type BookingRefusal = "not_found" | "not_allowed" | "has_va" | "open_demo" | "slot_taken" | "out_of_range" | "too_late" | "inactive";

const REFUSALS: Record<string, BookingRefusal> = {
  IVA01: "not_found",
  IVA06: "inactive",
  IVA07: "inactive",
  IVA14: "not_allowed",
  IVA16: "has_va",
  IVA17: "open_demo",
  IVA18: "slot_taken",
  IVA19: "out_of_range",
  IVA20: "too_late",
};

/** The database refusal as a reason; a unique-index race (two requests at once) reads like the check it backs. */
export function refusalOf(code: string | undefined, message: string | undefined): BookingRefusal | null {
  if (code && REFUSALS[code]) return REFUSALS[code];
  if (code === "23505") return message?.includes("one_open_per_client") ? "open_demo" : "slot_taken";
  return null;
}

/**
 * Slots the signed-in client may book now, soonest first (RLS returns only bookable ones in their tenant). With
 * `vaId`, only that VA's: the match page books a demo with one offered VA.
 */
export async function listOpenSlots(vaId?: string) {
  if (vaId !== undefined && !isUuid(vaId)) return [];
  const supabase = await createClient();
  let query = supabase.from("demo_slots").select("id, starts_at").order("starts_at").limit(500);
  if (vaId) query = query.eq("va_id", vaId);
  const { data, error } = await query;
  if (error) throw new UpstreamError("supabase", `Listing open slots failed (${error.code})`);
  return data.map((row) => ({ id: row.id, startsAt: row.starts_at }));
}

/** The client's most recent demo, or null. */
export async function getLatestDemo(clientId: string): Promise<ClientDemo | null> {
  if (!isUuid(clientId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("demo_bookings")
    .select("id, status, starts_at, ends_at, va_name, reject_reason")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the latest demo failed (${error.code})`);
  if (!data) return null;
  return { id: data.id, status: data.status, startsAt: data.starts_at, endsAt: data.ends_at, vaName: data.va_name, rejectReason: data.reject_reason };
}

/** Every demo the client has booked, newest first, with the VA it was with. RLS: the client's own only. */
export async function listClientDemos(clientId: string): Promise<(ClientDemo & { vaId: string })[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("demo_bookings")
    .select("id, va_id, status, starts_at, ends_at, va_name, reject_reason")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new UpstreamError("supabase", `Listing the client's demos failed (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    vaId: row.va_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    vaName: row.va_name,
    rejectReason: row.reject_reason,
  }));
}

type Result<T> = { ok: true; value: T } | { ok: false; reason: BookingRefusal };

async function call<T>(fn: "book_demo" | "decide_demo" | "cancel_demo", args: Record<string, unknown>, what: string): Promise<Result<T>> {
  // Secret key: these functions are executable only by service_role. Each checks the actor passed in, and the
  // caller passes the session user it has just verified with requireRole.
  const { data, error } = await createAdminClient().rpc(fn, args as never);
  if (error) {
    const reason = refusalOf(error.code, error.message);
    if (reason) return { ok: false, reason };
    throw new UpstreamError("supabase", `${what} failed (${error.code})`);
  }
  return { ok: true, value: data as T };
}

export type BookedDemo = { id: string; va_email: string; va_name: string; company_name: string; client_timezone: string | null; starts_at: string; client_note: string | null };
export type DecidedDemo = {
  status: "confirmed" | "rejected";
  client_email: string | null;
  contact_name: string;
  company_name: string;
  client_timezone: string | null;
  starts_at: string;
  va_name: string;
  reject_reason: string | null;
};
export type CancelledDemo = { previous_status: DemoStatus; va_email: string; va_name: string; company_name: string; starts_at: string };

export const bookDemo = (clientId: string, slotId: string, actor: string, note: string | null) =>
  call<BookedDemo>("book_demo", { client_id: clientId, slot_id: slotId, actor, note }, "Booking a demo");

export const decideDemo = (bookingId: string, actor: string, decision: "confirmed" | "rejected", reason: string | null) =>
  call<DecidedDemo>("decide_demo", { booking_id: bookingId, actor, decision, reason }, "Deciding a demo");

export const cancelDemo = (bookingId: string, actor: string) => call<CancelledDemo>("cancel_demo", { booking_id: bookingId, actor }, "Cancelling a demo");

export type VaDemo = { id: string; status: DemoStatus; startsAt: string; endsAt: string; companyName: string; clientTimezone: string | null; note: string | null };

/**
 * The VA's open demos still ahead: pending requests to answer and confirmed calls, soonest first. RLS returns
 * only the VA's own bookings; the va_id filter keeps it to them even for a reader with more access.
 */
export async function listVaDemos(vaId: string): Promise<VaDemo[]> {
  if (!isUuid(vaId)) return [];
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("demo_bookings")
    .select("id, status, starts_at, ends_at, company_name, client_timezone, client_note")
    .eq("va_id", vaId)
    .or(`and(status.eq.pending,starts_at.gt.${now}),and(status.eq.confirmed,ends_at.gt.${now})`)
    .order("starts_at");
  if (error) throw new UpstreamError("supabase", `Listing the VA's demos failed (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    companyName: row.company_name,
    clientTimezone: row.client_timezone,
    note: row.client_note,
  }));
}
