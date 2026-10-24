import "server-only";
import { packages } from "@/content/packages";
import { adminClientHref, closerClientHref, onboardingHref } from "@/content/routes";
import { site } from "@/content/site";
import type { ClientBusiness, ClientDetail } from "./contract";
import { sendOnboardingEmail, sendOnboardingSubmittedEmail } from "./email";
import { getClientCreator, getInvitation, issueOnboardingLink, markOnboardingEmailSent, revokeOnboardingLink, submitOnboarding } from "./onboarding-dal";
import { createOnboardingToken, hashOnboardingToken } from "./onboarding-token";
import type { OnboardingInput } from "./onboarding-validation";
import { insertClient, recordClientNote, saveClientBusiness, saveClientDetails, setClientDisabled } from "./dal";
import type { ClientDetailsInput, ClientNoteInput, NewClientInput } from "./validation";

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

/** Copies what the lead already told us onto the new pending client. The registration email comes later. */
export async function openClientRegistration(clientId: string, business: ClientBusiness) {
  await saveClientBusiness(clientId, business);
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
  const { token, hash } = createOnboardingToken();
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

/** What the public onboarding page shows for a token, by its hash. Viewing doesn't use the link up. */
export async function loadInvitation(token: string) {
  return getInvitation(hashOnboardingToken(token));
}

/** The client's submission: details, billing and consent, written once. */
export async function submitClientOnboarding(input: OnboardingInput) {
  return submitOnboarding(hashOnboardingToken(input.token), input);
}

/** Lets the Closer know the form is in. Runs after the response; a failure is only logged. */
export async function notifyOnboardingSubmitted(clientId: string) {
  const creator = await getClientCreator(clientId);
  if (!creator) return;
  await sendOnboardingSubmittedEmail({
    to: creator.email,
    name: creator.name,
    companyName: creator.companyName,
    // A client converted by an admin has no Closer: send them to the admin profile instead.
    profileUrl: new URL(creator.isCloser ? closerClientHref(clientId) : adminClientHref(clientId), site.url).toString(),
  });
}
