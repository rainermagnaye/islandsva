import type { ApiResponse } from "@/types/api";
import type { SubmitResult } from "@/types/form";
import type { LeadCreated, LeadField, LeadPayload } from "./contract";

export async function submitLead(payload: LeadPayload): Promise<SubmitResult<LeadField>> {
  try {
    const res = await fetch("/api/v1/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as ApiResponse<LeadCreated> | null;
    if (res.status === 429) return { ok: false, message: "You've sent a few messages in a row. Please wait a minute and try again." };
    return {
      ok: false,
      message: body?.error?.message ?? "Something went wrong. Please try again.",
      fieldErrors: body?.error?.fieldErrors,
    };
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
}
