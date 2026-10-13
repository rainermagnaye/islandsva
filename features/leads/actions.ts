"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { ConvertField } from "./contract";
import { convertLead as convert } from "./service";
import { parseConvert } from "./validation";

// Public POST endpoints: each re-checks the caller's role (admin with two-factor sign-in) itself.

const REFUSED = {
  not_found: "That lead no longer exists. Refresh the page.",
  converted: "This lead has already been converted to a client.",
  closed: "This lead is closed, so it can't be converted.",
} as const;

export async function convertLead(formData: FormData): Promise<SubmitResult<ConvertField>> {
  await requireRole(["admin"]);
  const parsed = parseConvert(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await convert(parsed.value);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead conversion failed", { service: error.service, error });
    return { ok: false, message: "We couldn't convert this lead just now. Please try again in a moment." };
  }

  refresh(); // re-render the lead list and stats in the same round trip
  return { ok: true };
}
