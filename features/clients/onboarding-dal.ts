import "server-only";
import { connection } from "next/server";
import { decodeBytea } from "@/lib/bytea";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import { clientBusinessFrom, onboardingAccess, type PublicOnboarding } from "./contract";
import { clientReviewSections } from "./registration";
import { TOKEN_SHAPE, onboardingTokenHash } from "./token";

// Registration packets (the customer's onboarding). The token and payment proof are server-only, so the reads and the
// customer's submit use the secret key; each caller has already checked access (see each function).

const PACKET_REFUSALS = { IVA06: "not_found", IVA07: "exists", IVA08: "submitted", IVA09: "closed" } as const;

function packetRefusal(code: string) {
  return PACKET_REFUSALS[code as keyof typeof PACKET_REFUSALS] ?? null;
}

/**
 * The registration link and what the customer has already sent.
 * The token is not granted to the signed-in role, so this uses the secret key. The caller has already
 * confirmed this admin can read the client.
 */
export async function getClientPacket(clientId: string) {
  if (!isUuid(clientId)) return null;
  const { data, error } = await createAdminClient()
    .from("client_packets")
    .select("token, consent_name, consent_signed_at, payment_proof_name, payment_proof_type, review_issues, review_note")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the registration link for ${clientId} failed: ${error.message}`, { cause: error });
  if (!data) return null;
  return {
    token: data.token,
    consentName: data.consent_name,
    consentSignedAt: data.consent_signed_at,
    paymentProofName: data.payment_proof_name,
    paymentProofType: data.payment_proof_type,
    reviewIssues: clientReviewSections(data.review_issues ?? []),
    reviewNote: data.review_note,
  };
}

/**
 * Only the registration token, for the Closer's copy of the link (they don't see the signature or payment file).
 * The token isn't granted to the signed-in role, so this uses the secret key; the caller has already read the
 * client under RLS, so a Closer reaches here only for a client they created.
 */
export async function getRegistrationToken(clientId: string) {
  if (!isUuid(clientId)) return null;
  const { data, error } = await createAdminClient().from("client_packets").select("token").eq("client_id", clientId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading the registration link for ${clientId} failed (${error.code})`);
  return data?.token ?? null;
}

/** Payment-file bytes. Not granted to the signed-in role; the caller has already confirmed they can read the client. */
export async function getClientPaymentProof(clientId: string) {
  if (!isUuid(clientId)) return null;
  const { data, error } = await createAdminClient()
    .from("client_packets")
    .select("payment_proof_name, payment_proof_type, payment_proof")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading payment proof for ${clientId} failed: ${error.message}`, { cause: error });
  if (!data?.payment_proof_name || !data.payment_proof_type || !data.payment_proof) return null;
  return { name: data.payment_proof_name, type: data.payment_proof_type, bytes: decodeBytea(data.payment_proof) };
}

/**
 * Stores the link and moves the client to pending customer.
 * Secret key: the packet table is not granted to authenticated. The caller has already checked the role
 * and that this admin can see the client.
 */
export async function issueClientOnboardingLink(clientId: string, token: string, tokenHash: string) {
  const { error } = await createAdminClient().rpc("issue_client_onboarding_link", {
    client_id: clientId,
    token,
    token_hash: tokenHash,
  });
  if (error) {
    const refusal = packetRefusal(error.code);
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Creating a registration link for ${clientId} failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/**
 * The packet for a registration link. There is no session: the token is the access, and anon cannot
 * read clients, so the secret key loads the row after the hash matches. An unknown token is null.
 */
export async function getPublicOnboarding(token: string): Promise<PublicOnboarding | null> {
  await connection();
  if (!TOKEN_SHAPE.test(token)) return null;
  const admin = createAdminClient();
  const { data: packet, error } = await admin
    .from("client_packets")
    .select("client_id, consent_name, payment_proof_name, review_issues, review_note")
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

  const access = onboardingAccess({ status: client.status, onboardingStatus: client.onboarding_status, disabledAt: client.disabled_at });
  const reviewIssues = clientReviewSections(packet.review_issues);
  const reviewNote = packet.review_note;
  // A return stored while the status was still pending review must reopen the same link.
  const sentBack = !access.closed && client.status === "pending" && client.onboarding_status === "pending_review" && (reviewIssues.length > 0 || Boolean(reviewNote));
  return {
    ...access,
    editable: access.editable || sentBack,
    companyName: client.company_name,
    contactName: client.contact_name,
    contactEmail: client.contact_email,
    contactPhone: client.contact_phone,
    business: clientBusinessFrom(client.business),
    packageCode: client.package_code,
    hoursPerWeek: client.hours_per_week,
    termMonths: client.term_months,
    monthlyCents: client.monthly_cents,
    startsOn: client.starts_on,
    timezone: client.timezone,
    consentName: packet.consent_name,
    paymentProofName: packet.payment_proof_name,
    reviewIssues,
    reviewNote,
  };
}

async function callReview(run: () => PromiseLike<{ error: { code?: string; message: string } | null }>, failure: string) {
  const { error } = await run();
  if (!error) return { ok: true as const };
  const refusal = packetRefusal(error.code ?? "");
  if (refusal) return { ok: false as const, reason: refusal };
  throw new UpstreamError("supabase", failure, { cause: error });
}

/** Stores the sections that still need a change. Secret key: the packet table is server-only. The caller has already checked this admin can see the client. */
export function saveClientReview(clientId: string, issues: string[], note: string) {
  return callReview(
    () => createAdminClient().rpc("save_client_review", { client_id: clientId, issues, note }),
    `Saving the review for ${clientId} failed`,
  );
}

/**
 * Accepts a clear packet and records the payment received, in one transaction (accept_client_review_paid), so a
 * packet is never approved without its payment. Secret key: the function is server-only and checks the actor is an
 * admin of the client's agency; the caller has already checked the session and read the client under RLS.
 */
export async function acceptClientReviewPaid(input: { clientId: string; actor: string; amountCents: number; feeCents: number; paidOn: string; reference: string | null }) {
  const { error } = await createAdminClient().rpc("accept_client_review_paid", {
    client_id: input.clientId,
    actor: input.actor,
    amount_cents: input.amountCents,
    fee_cents: input.feeCents,
    paid_on: input.paidOn,
    reference: input.reference,
  });
  if (!error) return { ok: true as const };
  if (error.code === "IVA14") return { ok: false as const, reason: "not_allowed" as const };
  if (error.code === "IVA21") return { ok: false as const, reason: "invalid" as const };
  const refusal = packetRefusal(error.code ?? "");
  if (refusal) return { ok: false as const, reason: refusal };
  throw new UpstreamError("supabase", `Confirming the registration for ${input.clientId} failed (${error.code})`);
}

/** Links the new login after the invite email. Same access rule as saveClientReview. */
export function recordClientInvite(clientId: string, userId: string) {
  return callReview(
    () => createAdminClient().rpc("record_client_invite", { client_id: clientId, user_id: userId }),
    `Linking the login for ${clientId} failed`,
  );
}
