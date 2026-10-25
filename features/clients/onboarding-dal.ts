import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";
import { timezoneForCountry } from "@/content/timezones";
import { clientBusinessFrom, clientBusinessToJson, clientReviewSections, onboardingAccess, onboardingState, type OnboardingLink, type OnboardingStatus, type PublicOnboarding } from "./contract";
import { onboardingTokenHash } from "./token";
import type { OnboardingInput } from "./validation";

// Onboarding links. Status is read with the signed-in session (RLS: the client's Closer and admins with 2FA).
// Issuing and withdrawing use the secret key: the functions are server-only because they take token hashes,
// and each checks the actor itself. Callers have already checked the session and read the client under RLS.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The latest link and the client's submission and email times, or null when the client isn't visible. */
export async function getOnboardingStatus(clientId: string): Promise<OnboardingStatus | null> {
  if (!UUID.test(clientId)) return null;
  const supabase = await createClient();
  const [client, links] = await Promise.all([
    supabase.from("clients").select("onboarding_submitted_at, registration_email_sent_at").eq("id", clientId).maybeSingle(),
    supabase
      .from("client_onboarding_links")
      .select("created_at, expires_at, submitted_at, revoked_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (client.error) throw new UpstreamError("supabase", `Reading onboarding for ${clientId} failed: ${client.error.message}`, { cause: client.error });
  if (links.error) throw new UpstreamError("supabase", `Reading onboarding links for ${clientId} failed: ${links.error.message}`, { cause: links.error });
  if (!client.data) return null;
  const row = links.data[0];
  const link: OnboardingLink | null = row
    ? { createdAt: row.created_at, expiresAt: row.expires_at, submittedAt: row.submitted_at, revokedAt: row.revoked_at }
    : null;
  const submittedAt = client.data.onboarding_submitted_at;
  return { state: onboardingState(link, submittedAt), link, submittedAt, emailedAt: client.data.registration_email_sent_at };
}

const ISSUE_REFUSALS = { IVA01: "not_found", IVA06: "not_pending", IVA07: "disabled", IVA13: "too_soon", IVA14: "not_allowed" } as const;
export type OnboardingRefusal = (typeof ISSUE_REFUSALS)[keyof typeof ISSUE_REFUSALS];

/** Stores a new link's hash (revoking the open one). Secret key: issue_onboarding_link is server-only. */
export async function issueOnboardingLink(clientId: string, issuedBy: string, tokenHash: string) {
  const { data, error } = await createAdminClient().rpc("issue_onboarding_link", { client_id: clientId, issued_by: issuedBy, token_hash: tokenHash });
  if (error) {
    const refusal = ISSUE_REFUSALS[error.code as keyof typeof ISSUE_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Issuing an onboarding link failed: ${error.message}`, { cause: error });
  }
  const [row] = data;
  if (!row) throw new UpstreamError("supabase", "Issuing an onboarding link returned no row");
  return { ok: true as const, expiresAt: row.link_expires_at };
}

/** Withdraws the open link, if any. Secret key: revoke_onboarding_link is server-only. */
export async function revokeOnboardingLink(clientId: string, revokedBy: string) {
  const { data, error } = await createAdminClient().rpc("revoke_onboarding_link", { client_id: clientId, revoked_by: revokedBy });
  if (error) {
    const refusal = ISSUE_REFUSALS[error.code as keyof typeof ISSUE_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Withdrawing an onboarding link failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, withdrawn: data };
}

/** Records that the mail provider accepted the onboarding email. Secret key: the column is server-only. */
export async function markOnboardingEmailSent(clientId: string) {
  const { error } = await createAdminClient().from("clients").update({ registration_email_sent_at: new Date().toISOString() }).eq("id", clientId);
  if (error) throw new UpstreamError("supabase", `Recording the onboarding email for ${clientId} failed: ${error.message}`, { cause: error });
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const PACKET_REFUSALS = { IVA06: "not_found", IVA07: "exists", IVA08: "submitted", IVA09: "closed" } as const;

function packetRefusal(code: string) {
  return PACKET_REFUSALS[code as keyof typeof PACKET_REFUSALS] ?? null;
}

function decodeBytea(value: string) {
  const hex = value.startsWith("\\x") ? value.slice(2) : /^[0-9a-fA-F]+$/.test(value) ? value : "";
  if (hex && hex.length % 2 === 0) return Uint8Array.from(Buffer.from(hex, "hex"));
  return Uint8Array.from(Buffer.from(value, "base64"));
}

/**
 * The registration link and what the customer has already sent.
 * The token is not granted to the signed-in role, so this uses the secret key. The caller has already
 * confirmed this admin can read the client.
 */
export async function getClientPacket(clientId: string) {
  if (!UUID.test(clientId)) return null;
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

/** Payment-file bytes. Not granted to the signed-in role; the caller has already confirmed they can read the client. */
export async function getClientPaymentProof(clientId: string) {
  if (!UUID.test(clientId)) return null;
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

/**
 * The proof already stored for this link. A return that did not include payment sends the same file again.
 * Secret key: the customer has no account, and the file is not granted to anon.
 */
export async function getPublicPaymentProof(token: string) {
  await connection();
  if (!TOKEN_SHAPE.test(token)) return null;
  const { data, error } = await createAdminClient()
    .from("client_packets")
    .select("payment_proof_name, payment_proof_type, payment_proof")
    .eq("token_hash", onboardingTokenHash(token))
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", "Reading a registration link failed", { cause: error });
  if (!data?.payment_proof_name || !data.payment_proof_type || !data.payment_proof) return null;
  return { name: data.payment_proof_name, type: data.payment_proof_type, bytes: decodeBytea(data.payment_proof) };
}

/** Writes the packet. Secret key: the customer has no account, and the packet table is server-only. */
export async function submitClientPacket(input: OnboardingInput, proof: { name: string; type: string; base64: string }) {
  const zone = timezoneForCountry(input.business.country);
  const details = clientBusinessToJson(input.business);
  if (zone) details.timezone = zone.value;
  const { data, error } = await createAdminClient().rpc("submit_client_packet", {
    token_hash: onboardingTokenHash(input.token),
    company_name: input.companyName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    details,
    consent_name: input.consentName,
    proof_name: proof.name,
    proof_type: proof.type,
    proof_base64: proof.base64,
  });
  if (error) {
    const refusal = packetRefusal(error.code);
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", "Saving a registration packet failed", { cause: error });
  }
  return { ok: true as const, clientId: data };
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

/** Accepts a clear packet and moves it to pending activation. Same access rule as saveClientReview. */
export function acceptClientReview(clientId: string) {
  return callReview(() => createAdminClient().rpc("accept_client_review", { client_id: clientId }), `Accepting the review for ${clientId} failed`);
}

/** Links the new login after the invite email. Same access rule as saveClientReview. */
export function recordClientInvite(clientId: string, userId: string) {
  return callReview(
    () => createAdminClient().rpc("record_client_invite", { client_id: clientId, user_id: userId }),
    `Linking the login for ${clientId} failed`,
  );
}
