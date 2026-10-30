import "server-only";
import { CURRENT_AGREEMENT_VERSION } from "@/content/agreement";
import { packages } from "@/content/packages";
import { requireRole } from "@/lib/auth/session";
import { timezoneForCountry } from "@/content/timezones";
import { inviteClient, rollbackInvite } from "@/features/users/service";
import type { ClientBusiness } from "./contract";
import { approveClientPayment, issueClientOnboardingLink, recordClientInvite, saveClientReview } from "./onboarding-dal";
import { listActiveAssignments } from "./assignment-dal";
import { onboardingUrl, registrationOrigin } from "./link";
import { createOnboardingToken, onboardingTokenHash } from "./token";
import { getClient, getOwnClientId, insertClient, insertPendingClient, listClients, saveClientBusiness, saveClientDetails, setClientDisabled } from "./dal";
import { recordClientNote } from "./notes-dal";
import type { ClientDetailsInput, ClientNoteInput, CreateClientInput } from "./validation";
import type { ClientReviewInput, NewClientInput, PaymentReceivedInput } from "./review-validation";
import { agreementMissingTerms, agreementReviewState, renderAgreement, type AgreementTerms } from "./agreement";
import { agreementHash } from "./agreement-hash";
import { acceptClientAgreementRow, getAgreementReview, getRegistrationState, saveRegistrationDetailsRow } from "./registration-dal";
import type { AgreementAcceptanceInput, RegistrationDetailsInput } from "./registration-validation";

/** A pending client added by a Closer. The monthly price comes from the catalogue for the chosen term. */
export async function createClientProfile(input: NewClientInput, createdBy: string) {
  const pkg = packages.find((item) => item.slug === input.packageSlug && item.weeklyHours === input.hoursPerWeek);
  if (!pkg) throw new Error(`Unknown package ${input.packageSlug} at ${input.hoursPerWeek} hours`);
  return insertClient({
    createdBy,
    companyName: input.companyName,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    packageCode: pkg.slug,
    hoursPerWeek: pkg.weeklyHours,
    termMonths: input.termMonths,
    monthlyCents: pkg.monthlyPrice[input.termMonths],
    startsOn: input.startsOn,
    timezone: input.timezone,
  });
}

/** Adds a pending client from the list. Registration starts later, from the client's profile. */
export async function createClientRecord(input: CreateClientInput, createdBy: string) {
  await insertPendingClient(input, createdBy);
}

/** Copies what the lead already told us onto the new pending client. The registration email comes later. */
export async function openClientRegistration(clientId: string, business: ClientBusiness) {
  await saveClientBusiness(clientId, business);
}

/**
 * Creates the stable registration link. The caller is an admin; this still checks the client is visible
 * to them before the secret key writes the token.
 */
export async function openOnboardingLink(clientId: string) {
  const client = await getClient(clientId);
  if (!client || client.disabledAt || client.status !== "pending") return { ok: false as const, reason: "not_found" as const };
  if (client.onboardingStatus !== "ready") return { ok: false as const, reason: "exists" as const };
  const token = createOnboardingToken();
  const stored = await issueClientOnboardingLink(clientId, token, onboardingTokenHash(token));
  if (!stored.ok) return stored;
  return { ok: true as const, url: onboardingUrl(token, await registrationOrigin()) };
}

export async function updateClientDetails(input: ClientDetailsInput) {
  return saveClientDetails(input);
}

/** Adds a note, with the optional file stored on the same row. */
export async function addClientNote(input: ClientNoteInput, file: { name: string; type: string; base64: string } | null) {
  return recordClientNote(input.clientId, input.body, file);
}

/** Hides the client from the list, or puts them back. */
export async function pauseClient(clientId: string, disabled: boolean) {
  return setClientDisabled(clientId, disabled);
}

/** Approves a packet in review and records the payment received. The caller is an admin; this still checks they can see the client. */
export async function confirmClientReviewPaid(input: PaymentReceivedInput, actor: string) {
  const client = await getClient(input.clientId);
  if (!client || client.disabledAt || client.status !== "pending" || client.onboardingStatus !== "pending_review") {
    return { ok: false as const, reason: "not_found" as const };
  }
  return approveClientPayment({ clientId: input.clientId, actor, amountCents: input.amount, feeCents: input.fee, paidOn: input.paidOn, reference: input.reference });
}

/** Sends the registration back to the sections that need a change. */
export async function returnClientReview(input: ClientReviewInput) {
  const client = await getClient(input.clientId);
  if (!client || client.disabledAt || client.status !== "pending" || client.onboardingStatus !== "pending_review") {
    return { ok: false as const, reason: "not_found" as const };
  }
  return saveClientReview(input.clientId, [...new Set(input.sections)], input.note);
}

/** Company, contact name, and email matches for the header search. */
export async function findClients(search: string, limit: number) {
  const page = await listClients({ search, pageSize: limit });
  return page.clients;
}

/** Sends the password invite once the review is accepted, then links that login to the client. */
export async function sendClientActivation(clientId: string, invitedBy: string, origin: string) {
  const client = await getClient(clientId);
  if (!client || client.disabledAt || client.status !== "pending" || client.onboardingStatus !== "approved") {
    return { ok: false as const, reason: "not_found" as const };
  }
  const invited = await inviteClient(client.contactEmail, client.contactName, invitedBy, origin);
  if (!invited.ok) return invited;
  try {
    const linked = await recordClientInvite(clientId, invited.userId);
    if (!linked.ok) {
      await rollbackInvite(invited.userId);
      return { ok: false as const, reason: "not_found" as const };
    }
  } catch (error) {
    await rollbackInvite(invited.userId).catch((cleanupError: unknown) => console.error("Orphaned client invite", { userId: invited.userId, cleanupError }));
    throw error;
  }
  return { ok: true as const };
}

/** The client record a client login belongs to (RLS: a client reads only their own), or null. */
export async function findOwnClient(userId: string) {
  const clientId = await getOwnClientId(userId);
  return clientId ? getClient(clientId) : null;
}

/** The signed-in client's active VAs whose name contains the term, for the header search. */
export async function findOwnVas(userId: string, term: string, limit: number) {
  const clientId = await getOwnClientId(userId);
  if (!clientId) return [];
  const needle = term.toLocaleLowerCase();
  const assignments = await listActiveAssignments(clientId);
  return assignments.filter((assignment) => assignment.vaName.toLocaleLowerCase().includes(needle)).slice(0, limit);
}

/** The current agreement for these terms: the text the page shows, and the fingerprint it posts back with the acceptance. */
export function currentAgreement(terms: AgreementTerms) {
  const text = renderAgreement(CURRENT_AGREEMENT_VERSION, terms);
  return { version: CURRENT_AGREEMENT_VERSION, text, fingerprint: agreementHash(text) };
}

/** Registration step 1. The token is the access; the database checks the step is open. */
export async function saveRegistrationDetails(input: RegistrationDetailsInput) {
  return saveRegistrationDetailsRow({ ...input, timezone: timezoneForCountry(input.business.country)?.value ?? null });
}

/**
 * Registration step 2. The terms are built from the stored client, never from the form, and the text stored is the
 * server's own render. If the page showed another version or other text (the terms changed since it loaded), nothing
 * is stored and the customer reads the agreement again.
 */
export async function acceptAgreement(input: AgreementAcceptanceInput, ipHash: string | null) {
  const state = await getRegistrationState(input.token);
  if (!state) return { ok: false as const, reason: "not_found" as const };
  if (agreementMissingTerms(state.terms)) return { ok: false as const, reason: "terms_missing" as const };
  const current = currentAgreement(state.terms);
  if (input.version !== current.version || input.fingerprint !== current.fingerprint) {
    // The same reason as the database's IVA43 (acceptClientAgreementRow), so the page maps one reason to one message.
    return { ok: false as const, reason: "changed" as const };
  }
  return acceptClientAgreementRow({ token: input.token, version: current.version, body: current.text, termsSeen: state.terms, signerName: input.signerName, ipHash });
}

/**
 * The agreement part of an admin's review: whether the packet can be approved (current, stale, earlier consent or
 * missing) and the acceptance it holds. Admins only: the role is checked here, before any read,
 * because the evidence (text, signer, contact email) is read with the secret key. Then the client is read under RLS,
 * so one this admin can't see is null.
 */
export async function agreementReviewFor(clientId: string) {
  await requireRole(["admin"]);
  const client = await getClient(clientId);
  if (!client) return null;
  const review = await getAgreementReview(client.id);
  if (!review) return null;
  return {
    state: agreementReviewState({ legacyConsent: review.legacyConsent, acceptedTerms: review.accepted?.terms ?? null, currentTerms: review.currentTerms }),
    accepted: review.accepted,
  };
}

export type AgreementReview = NonNullable<Awaited<ReturnType<typeof agreementReviewFor>>>;
