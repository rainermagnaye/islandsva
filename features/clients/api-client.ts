import type { ApiResponse } from "@/types/api";
import type { SubmitResult } from "@/types/form";
import type { OnboardingField, OnboardingPayload, OnboardingSubmitted } from "./contract";

/** Posts the public onboarding form. A used or expired link comes back as a message, not field errors. */
export async function submitOnboardingForm(payload: OnboardingPayload): Promise<SubmitResult<OnboardingField>> {
  try {
    const res = await fetch("/api/v1/onboarding-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as ApiResponse<OnboardingSubmitted> | null;
    if (res.status === 429) return { ok: false, message: "Too many tries in a row. Please wait a minute and try again." };
    return {
      ok: false,
      message: body?.error?.message ?? "Something went wrong. Please try again.",
      fieldErrors: body?.error?.fieldErrors,
    };
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
}
