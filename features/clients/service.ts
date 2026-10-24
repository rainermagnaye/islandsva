import "server-only";
import { packages } from "@/content/packages";
import type { ClientBusiness } from "./contract";
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
