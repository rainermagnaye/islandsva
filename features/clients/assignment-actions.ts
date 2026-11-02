"use server";

import { redirect } from "next/navigation";
import { adminClientHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { endAssignment } from "./assignment-dal";
import { parseAssignmentId } from "./validation";

// Admins only (with 2FA, enforced by requireRole and again by RLS). Accepting a shortlist is what creates an assignment.

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
