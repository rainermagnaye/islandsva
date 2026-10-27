import "server-only";
import { packages } from "@/content/packages";
import { inviteClient, rollbackInvite } from "@/features/users/service";
import type { ClientBusiness } from "./contract";
import { applyOpenSections, openClientSections } from "./registration";
import { acceptClientReviewPaid, getPublicOnboarding, getPublicPaymentProof, issueClientOnboardingLink, recordClientInvite, saveClientReview, submitClientPacket } from "./onboarding-dal";
import { onboardingUrl, registrationOrigin } from "./link";
import { createOnboardingToken, onboardingTokenHash } from "./token";
import { getClient, getOwnClientId, insertClient, insertPendingClient, listClients, saveClientBusiness, saveClientDetails, setClientDisabled } from "./dal";
import { recordClientNote } from "./notes-dal";
import type { ClientDetailsInput, ClientNoteInput, CreateClientInput, OnboardingInput } from "./validation";
import type { ClientReviewInput, NewClientInput, PaymentReceivedInput } from "./review-validation";

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

const PROOF_REQUIRED = "Upload proof of payment to submit.";

/** Saves the public packet. The token in the input is the access. A return keeps every section that was not sent back. */
export async function submitOnboarding(input: OnboardingInput, proof: { name: string; type: string; base64: string } | null) {
  const current = await getPublicOnboarding(input.token);
  if (!current) return { ok: false as const, reason: "not_found" as const };
  const open = openClientSections(current);
  const merged = applyOpenSections(input, current, open);
  const file = open.includes("payment") ? proof : (await storedProof(input.token)) ?? proof;
  if (!file) return { ok: false as const, message: PROOF_REQUIRED };
  return submitClientPacket(merged, file);
}

async function storedProof(token: string) {
  const stored = await getPublicPaymentProof(token);
  if (!stored) return null;
  return { name: stored.name, type: stored.type, base64: Buffer.from(stored.bytes).toString("base64") };
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

/** Accepts a clear packet and records the payment received. The caller is an admin; this still checks they can see the client. */
export async function confirmClientReviewPaid(input: PaymentReceivedInput, actor: string) {
  const client = await getClient(input.clientId);
  if (!client || client.disabledAt || client.status !== "pending" || client.onboardingStatus !== "pending_review") {
    return { ok: false as const, reason: "not_found" as const };
  }
  return acceptClientReviewPaid({ clientId: input.clientId, actor, amountCents: input.amount, feeCents: input.fee, paidOn: input.paidOn, reference: input.reference });
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
