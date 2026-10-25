import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { AdminDemoFilter, AdminDemoPage } from "./contract";

// The admin demo list, read as the signed-in admin: RLS returns every booking of their tenant only with a
// two-factor session (and the page has already called requireRole). Backed by (tenant_id, status, starts_at).

const PAGE_SIZE = 25;

/** Bookings soonest first within a filter (newest first for "All"), one page at a time; pages start at 1. */
export async function listAllDemos({ page = 1, filter }: { page?: number; filter?: AdminDemoFilter } = {}): Promise<AdminDemoPage> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const from = (page - 1) * PAGE_SIZE;
  let query = supabase
    .from("demo_bookings")
    .select("id, client_id, company_name, client_timezone, va_id, va_name, status, starts_at, ends_at, created_at", { count: "exact" });
  if (filter === "requested") query = query.eq("status", "pending").gt("starts_at", now);
  else if (filter === "confirmed") query = query.eq("status", "confirmed").gt("ends_at", now);
  else if (filter) query = query.eq("status", filter);
  const { data, error, count } = await query.order(filter ? "starts_at" : "created_at", { ascending: Boolean(filter) }).range(from, from + PAGE_SIZE - 1);

  // PostgREST answers a page past the end with "range not satisfiable" instead of an empty list.
  if (error?.code === "PGRST103") return { demos: [], total: 0, page, pageCount: 1 };
  if (error) throw new UpstreamError("supabase", `Listing demos failed (${error.code})`);

  // Admins read every profile, so show the VA's full name; the booking's first-name snapshot covers the rest.
  const names = await vaNames([...new Set(data.map((row) => row.va_id))]);
  const total = count ?? 0;
  return {
    demos: data.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      companyName: row.company_name,
      clientTimezone: row.client_timezone,
      vaName: names.get(row.va_id) || row.va_name,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function vaNames(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw new UpstreamError("supabase", `Reading VA names failed (${error.code})`);
  return new Map(data.map((row) => [row.id, row.full_name]));
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
