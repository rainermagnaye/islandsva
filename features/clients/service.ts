import "server-only";
import { packages } from "@/content/packages";
import { onboardingHref } from "@/content/routes";
import { site } from "@/content/site";
import { inviteClient, rollbackInvite } from "@/features/users/service";
import { applyOpenSections, openClientSections, type ClientBusiness, type ClientDetail } from "./contract";
import { sendOnboardingEmail } from "./email";
import { acceptClientReview, getPublicOnboarding, getPublicPaymentProof, issueClientOnboardingLink, issueOnboardingLink, markOnboardingEmailSent, recordClientInvite, revokeOnboardingLink, saveClientReview, submitClientPacket } from "./onboarding-dal";
import { createOnboardingToken as createEmailedToken } from "./onboarding-token";
import { onboardingUrl, registrationOrigin } from "./link";
import { createOnboardingToken, onboardingTokenHash } from "./token";
import { getClient, insertClient, insertPendingClient, listClients, recordClientNote, saveClientBusiness, saveClientDetails, setClientDisabled } from "./dal";
import type { ClientDetailsInput, ClientNoteInput, ClientReviewInput, CreateClientInput, NewClientInput, OnboardingInput } from "./validation";

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

/**
 * Issues a fresh onboarding link (the database withdraws any open one) and emails it to the client. The link is
 * returned once so the Closer can copy it when email isn't available. The email time is recorded only when the
 * mail provider accepts it.
 */
export async function sendOnboardingForm(client: Pick<ClientDetail, "id" | "contactName" | "contactEmail" | "companyName">, actorId: string) {
  const { token, hash } = createEmailedToken();
  const issued = await issueOnboardingLink(client.id, actorId, hash);
  if (!issued.ok) return issued;
  const link = new URL(onboardingHref(token), site.url).toString();
  const emailed = await sendOnboardingEmail({ to: client.contactEmail, contactName: client.contactName, companyName: client.companyName, link, expiresAt: issued.expiresAt });
  if (emailed) {
    // The client has the link either way; a failed bookkeeping write mustn't hide it from the Closer.
    await markOnboardingEmailSent(client.id).catch((error: unknown) => console.error("Recording the onboarding email failed", { error }));
  }
  return { ok: true as const, link, expiresAt: issued.expiresAt, emailed };
}

/** Withdraws the open link, so it stops working. */
export async function withdrawOnboardingForm(clientId: string, actorId: string) {
  return revokeOnboardingLink(clientId, actorId);
}

/** Accepts a clear packet. The caller is an admin; this still checks they can see the client. */
export async function confirmClientReview(clientId: string) {
  const client = await getClient(clientId);
  if (!client || client.disabledAt || client.status !== "pending" || client.onboardingStatus !== "pending_review") {
    return { ok: false as const, reason: "not_found" as const };
  }
  return acceptClientReview(clientId);
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
