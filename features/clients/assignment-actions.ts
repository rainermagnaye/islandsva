"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FORM_ERROR } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import { endAssignment } from "./assignment-dal";
import { parseAssignmentId } from "./validation";

// Admins only (with 2FA, enforced by requireRole and again by RLS). Accepting a shortlist is what creates an assignment.

/** Ends one assignment. The shortlist row stays as it was. */
export async function endClientVa(assignmentId: unknown): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseAssignmentId({ assignmentId });
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    if (!(await endAssignment(parsed.value.assignmentId))) return { ok: false, message: "That assignment has already ended. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Ending an assignment failed", { service: error.service, error: error.message });
    return { ok: false, message: "We couldn't end the assignment just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}
