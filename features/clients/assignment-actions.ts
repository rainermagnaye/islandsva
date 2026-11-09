"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { adminClientHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { assignClientVa as assignVa, endAssignment } from "./assignment-dal";
import { parseAssignVa, parseAssignmentId, type AssignVaField } from "./validation";

// Admins only (with 2FA, enforced by requireRole and again by the database). An admin assigns the client's VA once
// the payment is approved; a client accepting a shortlist also creates an assignment.

/** Assigns a VA to this client, so the client sees them on first sign-in without choosing. */
export async function assignClientVaAction(formData: FormData): Promise<SubmitResult<AssignVaField>> {
  await requireRole(["admin"]);
  const parsed = parseAssignVa(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await assignVa(parsed.value.clientId, parsed.value.vaId);
    if (!saved.ok) {
      return saved.reason === "not_found"
        ? { ok: false, message: "This client is no longer available. Refresh the page." }
        : { ok: false, message: "That VA can't be assigned right now. Refresh the page and check the package and the VA's profile." };
    }
  } catch (error) {
    return outageResult(error, "Assigning a VA");
  }
  refresh();
  return { ok: true };
}

/** Ends one assignment and returns to that client's Assistants tab. The shortlist row stays as it was. */
export async function endClientVa(assignmentId: unknown): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseAssignmentId({ assignmentId });
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    const ended = await endAssignment(parsed.value.assignmentId);
    if (!ended) return { ok: false, message: "That assignment has already ended. Refresh the page." };
    redirect(`${adminClientHref(ended.clientId)}?tab=assistants`);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Ending an assignment failed", { service: error.service, error: error.message });
    return { ok: false, message: "We couldn't end the assignment just now. Please try again in a moment." };
  }
}
