import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { Payment } from "./activation-contract";

// Payments and activation. Payments are read with the signed-in session (RLS: the client's Closer, the client,
// admins with 2FA). Writes go through server-only functions with the secret key — each checks the actor is the
// client's Closer or an admin of its tenant; callers have already checked the session and read the client under RLS.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A client's payments, newest first. */
export async function listPayments(clientId: string): Promise<Payment[]> {
  if (!UUID.test(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, status, amount_cents, term_months, provider_ref, paid_on, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new UpstreamError("supabase", `Reading payments for ${clientId} failed (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    status: row.status,
    amountCents: row.amount_cents,
    termMonths: row.term_months,
    reference: row.provider_ref,
    paidOn: row.paid_on,
    createdAt: row.created_at,
  }));
}

const REFUSALS = {
  IVA01: "not_found",
  IVA06: "not_pending",
  IVA07: "disabled",
  IVA11: "not_submitted",
  IVA12: "unpaid",
  IVA14: "not_allowed",
  IVA15: "login_taken",
  // check_violation: a future date, no package yet, an amount out of range, or already void.
  "23514": "invalid",
} as const;
export type ActivationRefusal = (typeof REFUSALS)[keyof typeof REFUSALS];

function refusalOf(error: { code: string }) {
  return REFUSALS[error.code as keyof typeof REFUSALS] ?? null;
}

/** Records a payment received outside the app. Secret key: record_manual_payment is server-only. */
export async function recordManualPayment(clientId: string, actorId: string, payment: { amountCents: number; reference: string; paidOn: string }) {
  const { error } = await createAdminClient().rpc("record_manual_payment", {
    client_id: clientId,
    recorded_by: actorId,
    amount_cents: payment.amountCents,
    provider_ref: payment.reference,
    paid_on: payment.paidOn,
  });
  if (error) {
    const reason = refusalOf(error);
    if (reason) return { ok: false as const, reason };
    throw new UpstreamError("supabase", `Recording a payment failed (${error.code})`);
  }
  return { ok: true as const };
}

/** Voids a payment marked by mistake (only before activation). Secret key: void_payment is server-only. */
export async function voidPayment(paymentId: string, actorId: string) {
  const { error } = await createAdminClient().rpc("void_payment", { payment_id: paymentId, voided_by: actorId });
  if (error) {
    const reason = refusalOf(error);
    if (reason) return { ok: false as const, reason };
    throw new UpstreamError("supabase", `Voiding a payment failed (${error.code})`);
  }
  return { ok: true as const };
}

/** Grants the client role, links the login and marks the client active. Secret key: activate_client is server-only. */
export async function activateClientRecord(clientId: string, userId: string, actorId: string) {
  const { error } = await createAdminClient().rpc("activate_client", { client_id: clientId, user_id: userId, activated_by: actorId });
  if (error) {
    const reason = refusalOf(error);
    if (reason) return { ok: false as const, reason };
    throw new UpstreamError("supabase", `Activating a client failed (${error.code})`);
  }
  return { ok: true as const };
}

/** The login linked to an active client, to resend their account email. Read under RLS. */
export async function getClientLogin(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("user_id, status, contact_name").eq("id", clientId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the client's login failed (${error.code})`);
  if (!data?.user_id || data.status !== "active") return null;
  return { userId: data.user_id, name: data.contact_name };
}

/** Whether a payment belongs to this client, read under RLS, before voiding it with the secret key. */
export async function paymentBelongsTo(paymentId: string, clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("id").eq("id", paymentId).eq("client_id", clientId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading payment ${paymentId} failed (${error.code})`);
  return data !== null;
}
