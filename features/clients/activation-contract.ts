import type { Enums } from "@/types/database";
import type { ClientDetail } from "./contract";

// Payments recorded by hand and activation. Shared by the server and the profile panels. No Zod here.

export type PaymentStatus = Enums<"payment_status">;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = { paid: "Paid", void: "Voided" };

/** Mirrors the payments CHECKs: 1 cent to US$1,000,000; a reference of up to 200 characters. */
export const PAYMENT_LIMITS = { maxCents: 100_000_000, reference: 200 } as const;

export type PaymentField = "amount" | "reference" | "paidOn";

export type Payment = {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  termMonths: number;
  reference: string | null;
  paidOn: string;
  createdAt: string;
};

/** What activation still needs, in the order a Closer works through it. Empty means ready. */
export function activationBlockers(client: Pick<ClientDetail, "status" | "disabledAt" | "onboardingSubmittedAt" | "consentedAt">, payments: readonly Pick<Payment, "status">[]) {
  const blockers: string[] = [];
  if (client.status !== "pending") return ["The client is already active."];
  if (client.disabledAt) blockers.push("Enable the client first.");
  if (!client.onboardingSubmittedAt || !client.consentedAt) blockers.push("Waiting for the client's onboarding form.");
  if (!payments.some((payment) => payment.status === "paid")) blockers.push("Record their payment.");
  return blockers;
}

/** What activating returns: whether the account email went out. */
export type ActivationResult = { ok: true; emailed: boolean } | { ok: false; message: string };
