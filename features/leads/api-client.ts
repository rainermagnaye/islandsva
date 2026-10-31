import type { ApiResponse } from "@/types/api";
import type { SubmitResult } from "@/types/form";
import type { DiscoverySlots, LeadCreated, LeadField, LeadPayload } from "./contract";

/** The open discovery-call starts (UTC instants), or the message to show when they can't be loaded. */
export async function fetchDiscoverySlots(): Promise<{ ok: true; slots: string[] } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/v1/discovery-slots", { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as ApiResponse<DiscoverySlots> | null;
    if (res.ok && body?.data) return { ok: true, slots: body.data.slots };
    if (res.status === 429) return { ok: false, message: "Too many requests in a row. Please wait a minute and try again." };
    return { ok: false, message: body?.error?.message ?? "We couldn't load the open times. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
}

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
