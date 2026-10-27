import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { DemoCalendarRow } from "./calendar";

// Demo bookings the admin calendar reads as the signed-in admin. RLS returns the agency's rows only with a
// two-factor session (and the page has already called requireRole).

async function vaNames(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw new UpstreamError("supabase", `Reading VA names failed (${error.code})`);
  return new Map(data.map((row) => [row.id, row.full_name]));
}

const CALENDAR_BACK_DAYS = 120;
const CALENDAR_AHEAD_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Bookings the calendar can page through, a few months either side of today. The list below stays paged on its own. */
export async function listCalendarDemos(now = new Date()): Promise<DemoCalendarRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("demo_bookings")
    .select("id, client_id, company_name, va_id, va_name, status, starts_at, ends_at")
    .gte("starts_at", new Date(now.getTime() - CALENDAR_BACK_DAYS * DAY_MS).toISOString())
    .lte("starts_at", new Date(now.getTime() + CALENDAR_AHEAD_DAYS * DAY_MS).toISOString())
    .order("starts_at")
    .limit(500);
  if (error) throw new UpstreamError("supabase", `Listing the demo calendar failed (${error.code})`);

  const names = await vaNames([...new Set(data.map((row) => row.va_id))]);
  return data.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    companyName: row.company_name,
    vaName: names.get(row.va_id) || row.va_name,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}

/** Head-only count of requests still waiting for a VA's answer, for the admin overview. */
export async function countOpenRequests() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("demo_bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gt("starts_at", new Date().toISOString());
  if (error) throw new UpstreamError("supabase", `Counting demo requests failed (${error.code})`);
  return count ?? 0;
}
