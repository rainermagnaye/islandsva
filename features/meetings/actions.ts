"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { FORM_ERROR, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { DiscoveryTimesField } from "./contract";
import { saveDiscoveryTimes, type DiscoveryTimesRefusal } from "./dal";
import { parseDiscoveryTimes } from "./validation";

const REFUSAL_MESSAGES: Record<DiscoveryTimesRefusal, string> = {
  not_allowed: "Your two-factor sign-in has expired. Sign in again, then save.",
  conflict: "Someone else just saved the times. Reload the page to see them, then save again.",
  invalid: FORM_ERROR,
};

/** "Discovery calls" settings: replaces the agency's daily times. The admin check comes first, then RLS. */
export async function saveDiscoveryTimesAction(formData: FormData): Promise<SubmitResult<DiscoveryTimesField>> {
  await requireRole(["admin"]);
  const parsed = parseDiscoveryTimes({ ...formEntries(formData), times: formData.getAll("times") });
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await saveDiscoveryTimes(parsed.value.times);
    if (!result.ok) {
      // A form that passed validation but was refused as invalid is a bug worth seeing in the logs.
      if (result.reason === "invalid") console.error("Saving discovery times was refused as invalid");
      return { ok: false, message: REFUSAL_MESSAGES[result.reason] };
    }
  } catch (error) {
    return outageResult(error, "Saving discovery times");
  }
  refresh();
  return { ok: true };
}
