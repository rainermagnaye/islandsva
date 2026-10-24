"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { ActivationResult, PaymentField } from "./activation-contract";
import type { ActivationRefusal } from "./activation-dal";
import { parseManualPayment, parsePaymentTarget } from "./activation-validation";
import { getClient } from "./dal";
import { activateClientAccount, markClientPaid, resendClientAccountEmail, voidClientPayment } from "./service";
import { parseClientId } from "./validation";

// Each action: the session first (a Closer or an admin with 2FA), then the client read under RLS — so only the
// client's own Closer or an admin of its tenant gets further — then the server-only database function, which
// checks the actor again.

const REFUSED: Record<ActivationRefusal | "rate", string> = {
  not_found: "That client no longer exists. Refresh the page.",
  not_pending: "This client is already active.",
  disabled: "This client is disabled. Enable them first.",
  not_submitted: "The client hasn't sent their onboarding form yet.",
  unpaid: "Record their payment before activating.",
  not_allowed: "Only the client's Closer or an admin can do this.",
  login_taken: "An account already uses this email. Ask an admin to sort it out before activating.",
  invalid: "That payment can't be recorded. Check the client has a package and the date isn't in the future.",
  rate: "Too many account emails were sent just now. Please try again in a few minutes.",
};
const TAMPERED = "Something went wrong with the form. Please refresh the page and try again.";
const OUTAGE = "That didn't go through just now. Please try again in a moment.";

function outage(error: unknown, what: string): { ok: false; message: string } {
  if (!(error instanceof UpstreamError)) throw error;
  console.error(`${what} failed`, { service: error.service, error: error.message });
  return { ok: false, message: OUTAGE };
}

/** "Mark as paid": a payment received outside the app. */
export async function recordClientPayment(formData: FormData): Promise<SubmitResult<PaymentField>> {
  const user = await requireRole(["closer", "admin"]);
  const parsed = parseManualPayment(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    if (!(await getClient(parsed.value.clientId))) return { ok: false, message: REFUSED.not_found };
    const result = await markClientPaid(parsed.value, user.id);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
  } catch (error) {
    return outage(error, "Recording a payment");
  }
  refresh();
  return { ok: true };
}

/** Voids a payment marked by mistake, while the client is still pending. */
export async function voidClientPaymentAction(clientId: unknown, paymentId: unknown): Promise<SubmitResult> {
  const user = await requireRole(["closer", "admin"]);
  const parsed = parsePaymentTarget({ clientId, paymentId });
  if (!parsed.ok) return { ok: false, message: TAMPERED };
  try {
    if (!(await getClient(parsed.value.clientId))) return { ok: false, message: REFUSED.not_found };
    const result = await voidClientPayment(parsed.value.paymentId, user.id);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
  } catch (error) {
    return outage(error, "Voiding a payment");
  }
  refresh();
  return { ok: true };
}

/** Activates the client: creates their login, marks them active and emails them a link to choose a password. */
export async function activateClient(clientId: unknown): Promise<ActivationResult> {
  const user = await requireRole(["closer", "admin"]);
  const parsed = parseClientId({ clientId });
  if (!parsed.ok) return { ok: false, message: TAMPERED };
  try {
    const client = await getClient(parsed.value.clientId);
    if (!client) return { ok: false, message: REFUSED.not_found };
    const result = await activateClientAccount(client, user.id);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
    refresh();
    return result;
  } catch (error) {
    return outage(error, "Activating a client");
  }
}

/** Sends an active client a fresh link to choose a password. */
export async function resendClientAccount(clientId: unknown): Promise<ActivationResult> {
  await requireRole(["closer", "admin"]);
  const parsed = parseClientId({ clientId });
  if (!parsed.ok) return { ok: false, message: TAMPERED };
  try {
    const client = await getClient(parsed.value.clientId);
    if (!client) return { ok: false, message: REFUSED.not_found };
    const result = await resendClientAccountEmail(client);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
    return result;
  } catch (error) {
    return outage(error, "Resending the account email");
  }
}
