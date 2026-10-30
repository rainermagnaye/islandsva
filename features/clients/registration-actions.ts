"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { clientIp } from "@/lib/api/client-ip";
import { hashIp } from "@/lib/api/ip-hash";
import { formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { AgreementAcceptanceField, ClientDetailField, PaymentProofStepField } from "./contract";
import { saveRegistrationProofRow } from "./registration-dal";
import { AGREEMENT_CHANGED, parseAgreementAcceptance, parsePaymentProofStep, parseRegistrationDetails } from "./registration-validation";
import { acceptAgreement, saveRegistrationDetails } from "./service";

// The registration link's three steps. Nobody is signed in: the link's token (a hidden field) is the access check,
// and the database checks it again, with the step's status, in every write. After a save the page re-renders on
// the next open step.

const NOT_FOUND = "This registration link is not valid.";
const NOT_OPEN = "This registration can't be changed now.";

const REFUSED = {
  not_found: NOT_FOUND,
  not_open: NOT_OPEN,
  closed: NOT_OPEN,
  changed: AGREEMENT_CHANGED,
  terms_missing: "Your package isn't set up yet. Contact your account manager.",
} as const;

/** Step 1: company details. */
export async function saveRegistrationDetailsAction(formData: FormData): Promise<SubmitResult<ClientDetailField>> {
  const parsed = parseRegistrationDetails(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await saveRegistrationDetails(parsed.value);
    if (!result.ok) return { ok: false, message: result.reason === "invalid" ? "Check the details and try again." : REFUSED[result.reason] };
  } catch (error) {
    return outageResult(error, "Saving registration details");
  }
  refresh();
  return { ok: true };
}

/** Step 2: the agreement. The IP is hashed and kept only as evidence of who accepted. */
export async function acceptAgreementAction(formData: FormData): Promise<SubmitResult<AgreementAcceptanceField>> {
  const parsed = parseAgreementAcceptance(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const ipHash = await hashIp(clientIp(await headers()));
    const result = await acceptAgreement(parsed.value, ipHash);
    if (!result.ok) return { ok: false, message: result.reason === "invalid" ? "Check your name and try again." : REFUSED[result.reason] };
  } catch (error) {
    return outageResult(error, "Accepting the agreement");
  }
  refresh();
  return { ok: true };
}

/** Step 3: the payment proof. Size and type are checked (by the parser) before the file is read. */
export async function saveRegistrationProofAction(formData: FormData): Promise<SubmitResult<PaymentProofStepField>> {
  const parsed = parsePaymentProofStep(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  const { token, file, name, type } = parsed.value;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await saveRegistrationProofRow(token, { name, type, base64 });
    if (!result.ok) return { ok: false, message: result.reason === "invalid" ? "Use a PDF, JPG, PNG or WebP, up to 2 MB." : REFUSED[result.reason] };
  } catch (error) {
    return outageResult(error, "Saving payment proof");
  }
  refresh();
  return { ok: true };
}
