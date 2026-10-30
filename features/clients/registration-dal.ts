import "server-only";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import { agreementTerms, agreementTermsFrom, sameAgreementTerms, type AgreementTerms } from "./agreement";
import { clientBusinessFrom, clientBusinessToJson, onboardingAccess, type ClientBusiness, type ClientOnboardingStatus } from "./contract";
import { registrationIssues } from "./registration";
import { TOKEN_SHAPE, onboardingTokenHash } from "./token";

// The registration link's three steps (20261029172015_registration_agreement). The visitor isn't signed in: the
// link's token is the access check, and the packet and agreement tables are server-only, so every call here uses
// the secret key. Each step function maps its own refusal codes.

/** Shared by the three steps: unknown link, step not open, client disabled or no longer pending, a value refused. */
const STEP_REFUSALS = { IVA06: "not_found", IVA08: "not_open", IVA09: "closed", "23514": "invalid" } as const;

const AGREEMENT_REFUSALS = { ...STEP_REFUSALS, IVA43: "changed", IVA45: "terms_missing" } as const;

type StepResult<Reason> = { ok: true; status: ClientOnboardingStatus } | { ok: false; reason: Reason };

function stepResult<Refusals extends Record<string, string>>(
  refusals: Refusals,
  data: ClientOnboardingStatus | null,
  error: { code?: string } | null,
  failure: string,
): StepResult<Refusals[keyof Refusals]> {
  if (!error && data) return { ok: true, status: data };
  const reason = error?.code && Object.hasOwn(refusals, error.code) ? refusals[error.code as keyof Refusals] : undefined;
  if (reason) return { ok: false, reason };
  throw new UpstreamError("supabase", `${failure} (${error?.code ?? "no status"})`);
}

/** What the three-step page and the step services need for one link, or null for an unknown token. */
export async function getRegistrationState(token: string) {
  await connection();
  if (!TOKEN_SHAPE.test(token)) return null;
  const admin = createAdminClient();
  const { data: packet, error } = await admin
    .from("client_packets")
    .select("client_id, agreement_id, payment_proof_name, review_issues, review_note")
    .eq("token_hash", onboardingTokenHash(token))
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", "Reading a registration link failed", { cause: error });
  if (!packet) return null;

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("company_name, contact_name, contact_email, contact_phone, status, onboarding_status, disabled_at, package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone, business")
    .eq("id", packet.client_id)
    .maybeSingle();
  if (clientError) throw new UpstreamError("supabase", "Reading a registration link failed", { cause: clientError });
  if (!client) return null;

  // The raw stored country, as private.client_agreement_terms reads it (business ->> 'country').
  const raw = client.business && typeof client.business === "object" && !Array.isArray(client.business) ? (client.business as Record<string, unknown>) : {};
  const terms: AgreementTerms = agreementTerms({
    companyName: client.company_name,
    countryOnFile: typeof raw.country === "string" ? raw.country : null,
    packageCode: client.package_code,
    hoursPerWeek: client.hours_per_week,
    termMonths: client.term_months,
    monthlyCents: client.monthly_cents,
    startsOn: client.starts_on,
  });

  let agreementCurrent = false;
  if (packet.agreement_id) {
    const { data: agreement, error: agreementError } = await admin.from("client_agreements").select("terms").eq("id", packet.agreement_id).maybeSingle();
    if (agreementError) throw new UpstreamError("supabase", "Reading a registration link failed", { cause: agreementError });
    const accepted = agreementTermsFrom(agreement?.terms);
    agreementCurrent = accepted !== null && sameAgreementTerms(accepted, terms);
  }

  const access = onboardingAccess({ status: client.status, onboardingStatus: client.onboarding_status, disabledAt: client.disabled_at });
  return {
    ...access,
    onboardingStatus: client.onboarding_status,
    companyName: client.company_name,
    contactName: client.contact_name,
    contactEmail: client.contact_email,
    contactPhone: client.contact_phone,
    business: clientBusinessFrom(client.business),
    timezone: client.timezone,
    terms,
    agreementCurrent,
    paymentProofName: packet.payment_proof_name,
    reviewIssues: registrationIssues(packet.review_issues),
    reviewNote: packet.review_note,
  };
}

export type RegistrationState = NonNullable<Awaited<ReturnType<typeof getRegistrationState>>>;

/** Step 1. The details (and the time zone the country implies) as save_client_packet_details stores them. */
export async function saveRegistrationDetailsRow(input: {
  token: string;
  companyName: string;
  contactName: string;
  contactPhone: string | null;
  business: ClientBusiness;
  timezone: string | null;
}) {
  const details = clientBusinessToJson(input.business);
  if (input.timezone) details.timezone = input.timezone;
  const { data, error } = await createAdminClient().rpc("save_client_packet_details", {
    token_hash: onboardingTokenHash(input.token),
    company_name: input.companyName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    details,
  });
  return stepResult(STEP_REFUSALS, data, error, "Saving registration details failed");
}

/** Step 2. The body and terms are the server's own render and snapshot, never the page's. */
export async function acceptClientAgreementRow(input: { token: string; version: string; body: string; termsSeen: AgreementTerms; signerName: string; ipHash: string | null }) {
  const { data, error } = await createAdminClient().rpc("accept_client_agreement", {
    token_hash: onboardingTokenHash(input.token),
    version: input.version,
    body: input.body,
    terms_seen: input.termsSeen,
    signer_name: input.signerName,
    ip_hash: input.ipHash,
  });
  return stepResult(AGREEMENT_REFUSALS, data, error, "Accepting the agreement failed");
}

/** Step 3. The proof file, base64-encoded for the database function. One write, so the action calls this directly. */
export async function saveRegistrationProofRow(token: string, proof: { name: string; type: string; base64: string }) {
  const { data, error } = await createAdminClient().rpc("save_client_payment_proof", {
    token_hash: onboardingTokenHash(token),
    proof_name: proof.name,
    proof_type: proof.type,
    proof_base64: proof.base64,
  });
  return stepResult(STEP_REFUSALS, data, error, "Saving payment proof failed");
}

/**
 * A client's agreement acceptances, newest first. Secret key: client_agreements has no policy for signed-in users.
 * Only after the caller has read the client under RLS (agreementEvidenceFor), so an admin reaches here only for a
 * client they may see.
 */
export async function getAgreementEvidence(clientId: string) {
  if (!isUuid(clientId)) return [];
  const { data, error } = await createAdminClient()
    .from("client_agreements")
    .select("id, version, body, terms, signer_name, contact_email_on_file, ip_hash, accepted_at")
    .eq("client_id", clientId)
    .order("accepted_at", { ascending: false });
  if (error) throw new UpstreamError("supabase", `Reading agreement evidence for ${clientId} failed (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    version: row.version,
    body: row.body,
    terms: agreementTermsFrom(row.terms),
    signerName: row.signer_name,
    contactEmailOnFile: row.contact_email_on_file,
    ipRecorded: row.ip_hash !== null,
    acceptedAt: row.accepted_at,
  }));
}
