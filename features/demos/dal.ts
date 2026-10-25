import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import { DEMO_LIMITS, type VaSlot } from "./contract";

// Slots are read and written with the signed-in session: RLS lets an open VA add their own (future, at most 30
// days ahead), read their own and delete their own unused ones. Bookings are read under RLS too; they are
// written only by the server functions (see booking-dal.ts).

/** The VA's slots from now to the end of the publishing window, each with its booking (other than a cancelled one). */
export async function listVaSlots(vaId: string): Promise<VaSlot[]> {
  if (!isUuid(vaId)) return [];
  const supabase = await createClient();
  const until = new Date(Date.now() + (DEMO_LIMITS.publishDays + 1) * 24 * 3600 * 1000).toISOString();
  const { data: slots, error } = await supabase
    .from("demo_slots")
    .select("id, starts_at")
    .eq("va_id", vaId)
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", until)
    .order("starts_at");
  if (error) throw new UpstreamError("supabase", `Listing slots failed (${error.code})`);
  if (slots.length === 0) return [];

  const { data: bookings, error: bookingError } = await supabase
    .from("demo_bookings")
    .select("slot_id, status, company_name")
    .eq("va_id", vaId)
    .neq("status", "cancelled")
    .in("slot_id", slots.map((slot) => slot.id));
  if (bookingError) throw new UpstreamError("supabase", `Reading slot bookings failed (${bookingError.code})`);
  const bySlot = new Map(bookings.map((row) => [row.slot_id, { status: row.status, companyName: row.company_name }]));
  return slots.map((slot) => ({ id: slot.id, startsAt: slot.starts_at, booking: bySlot.get(slot.id) ?? null }));
}

/**
 * Publishes slots for the VA. A time they already offer is skipped (on conflict do nothing), so re-adding a day
 * is harmless. "not_allowed" when RLS refuses (not an open VA, or a time out of range).
 */
export async function insertSlots(vaId: string, startsAt: readonly string[]) {
  const supabase = await createClient();
  const rows = startsAt.map((start) => ({
    va_id: vaId,
    starts_at: start,
    ends_at: new Date(Date.parse(start) + DEMO_LIMITS.slotMinutes * 60 * 1000).toISOString(),
  }));
  const { data, error } = await supabase.from("demo_slots").upsert(rows, { onConflict: "va_id,starts_at", ignoreDuplicates: true }).select("id");
  if (error?.code === "42501") return { ok: false as const, reason: "not_allowed" as const };
  if (error?.code === "23514") return { ok: false as const, reason: "invalid" as const };
  if (error) throw new UpstreamError("supabase", `Adding slots failed (${error.code})`);
  return { ok: true as const, added: data.length };
}

/** Deletes one of the VA's own slots; false when it's gone, booked or no longer ahead (RLS filters it out). */
export async function deleteSlot(vaId: string, slotId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("demo_slots").delete().eq("id", slotId).eq("va_id", vaId).select("id");
  // IVA20: a client booked it while the delete waited (the database's guard trigger).
  if (error?.code === "IVA20") return false;
  if (error) throw new UpstreamError("supabase", `Deleting a slot failed (${error.code})`);
  return data.length > 0;
}
