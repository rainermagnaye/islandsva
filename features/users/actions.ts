"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { InviteField } from "./contract";
import { inviteStaff as invite } from "./service";
import { parseInvite } from "./validation";

// Public POST endpoints: each re-checks the caller's role (admin with two-factor sign-in) itself.

export async function inviteStaff(formData: FormData): Promise<SubmitResult<InviteField>> {
  const admin = await requireRole(["admin"]);
  const parsed = parseInvite(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await invite(parsed.value, admin.id);
    if (!result.ok) {
      return { ok: false, message: FIELD_ERRORS, fieldErrors: { email: "That email already has an account." } };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Staff invite failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send the invitation. Please try again in a moment." };
  }

  refresh(); // re-render the user list in the same round trip
  return { ok: true };
}
