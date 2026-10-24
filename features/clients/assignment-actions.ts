"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { endActiveAssignment, insertAssignment } from "./assignment-dal";
import { getClient } from "./dal";
import { parseClientId, parseVaAssignment } from "./validation";

// Admins only (with 2FA, enforced by requireRole and again by RLS on client_va_assignments).

const REFUSED = {
  taken: "This client already has a VA. End that assignment first.",
  not_va: "That person isn't an active VA any more. Refresh the page and choose another.",
  not_allowed: "Only an admin with two-factor sign-in can assign VAs.",
} as const;

/** Assigns a VA to the client. */
export async function assignClientVa(formData: FormData): Promise<SubmitResult<"vaId">> {
  const user = await requireRole(["admin"]);
  const parsed = parseVaAssignment(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    if (!(await getClient(parsed.value.clientId))) return { ok: false, message: "That client no longer exists. Refresh the page." };
    const result = await insertAssignment(parsed.value.clientId, parsed.value.vaId, user.id);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Assigning a VA failed", { service: error.service, error: error.message });
    return { ok: false, message: "We couldn't assign the VA just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}

/** Ends the client's current assignment. */
export async function endClientVa(clientId: unknown): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseClientId({ clientId });
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    if (!(await endActiveAssignment(parsed.value.clientId))) return { ok: false, message: "This client has no VA right now. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Ending an assignment failed", { service: error.service, error: error.message });
    return { ok: false, message: "We couldn't end the assignment just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}
