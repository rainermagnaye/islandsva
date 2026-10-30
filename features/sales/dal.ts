import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { SalesPayment } from "./contract";

// Sales reads, as the signed-in admin: RLS returns payments and clients of their own agency only, and only with
// a two-factor session (the page has also called requireRole). Payments are recorded by
// approve_client_payment (features/clients); this feature only reads them. Backed by payments (tenant_id,
// paid_on) where status = 'paid'.

/** Paid (not voided) payments on or after `since` ("2025-11-01"), newest first, with the client's company. */
export async function listPaymentsSince(since: string): Promise<SalesPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, client_id, amount_cents, fee_cents, paid_on, provider_ref")
    .eq("status", "paid")
    .gte("paid_on", since)
    .order("paid_on", { ascending: false })
    .limit(2000);
  if (error) throw new UpstreamError("supabase", `Listing payments failed (${error.code})`);
  const names = await companyNames([...new Set(data.map((row) => row.client_id))]);
  return data.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    companyName: names.get(row.client_id) ?? "Client",
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    paidOn: row.paid_on,
    reference: row.provider_ref,
  }));
}

async function companyNames(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, company_name").in("id", ids);
  if (error) throw new UpstreamError("supabase", `Reading client names failed (${error.code})`);
  return new Map(data.map((row) => [row.id, row.company_name]));
}

/** Monthly recurring revenue: the agreed monthly price of every active, enabled client, and how many there are. */
export async function recurringRevenue() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("monthly_cents").eq("status", "active").is("disabled_at", null);
  if (error) throw new UpstreamError("supabase", `Reading recurring revenue failed (${error.code})`);
  return { cents: data.reduce((sum, row) => sum + (row.monthly_cents ?? 0), 0), clients: data.length };
}
