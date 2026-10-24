"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { closerClientHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { ClientDetailField, ClientNoteField, NewClientField, OnboardingSendResult } from "./contract";
import { getClient } from "./dal";
import type { OnboardingRefusal } from "./onboarding-dal";
import { acceptClientAttachment } from "./attachment";
import { addClientNote, createClientProfile, pauseClient, sendOnboardingForm, updateClientDetails, withdrawOnboardingForm } from "./service";
import { parseClientDetails, parseClientFlag, parseClientId, parseClientNote, parseNewClient } from "./validation";

const ONBOARDING_REFUSALS: Record<OnboardingRefusal, string> = {
  not_found: "That client no longer exists. Refresh the page.",
  not_pending: "This client is already active, so there's no form to send.",
  disabled: "This client is disabled. Enable them first.",
  too_soon: "A form went out a moment ago. Wait a couple of minutes before sending another.",
  not_allowed: "Only the client's Closer or an admin can do this.",
};

/**
 * Sends (or resends) the onboarding form. The client is read under RLS first, so only their Closer or an admin
 * with 2FA gets this far; the database checks the actor again. Returns the link once, for copying.
 */
export async function sendClientOnboarding(clientId: unknown): Promise<OnboardingSendResult> {
  const user = await requireRole(["closer", "admin"]);
  const parsed = parseClientId({ clientId });
  if (!parsed.ok) return { ok: false, message: "Something went wrong with the form. Please refresh the page and try again." };
  try {
    const client = await getClient(parsed.value.clientId);
    if (!client) return { ok: false, message: ONBOARDING_REFUSALS.not_found };
    const sent = await sendOnboardingForm(client, user.id);
    if (!sent.ok) return { ok: false, message: ONBOARDING_REFUSALS[sent.reason] };
    refresh();
    return sent;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Onboarding send failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send the form just now. Please try again in a moment." };
  }
}

/** Withdraws the open onboarding link, so it stops working. Same access rules as sending. */
export async function withdrawClientOnboarding(clientId: unknown): Promise<SubmitResult> {
  const user = await requireRole(["closer", "admin"]);
  const parsed = parseClientId({ clientId });
  if (!parsed.ok) return { ok: false, message: "Something went wrong with the form. Please refresh the page and try again." };
  try {
    const client = await getClient(parsed.value.clientId);
    if (!client) return { ok: false, message: ONBOARDING_REFUSALS.not_found };
    const result = await withdrawOnboardingForm(client.id, user.id);
    if (!result.ok) return { ok: false, message: ONBOARDING_REFUSALS[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Onboarding withdraw failed", { service: error.service, error });
    return { ok: false, message: "We couldn't withdraw the link just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}

/** A Closer adds a pending client with the agreed package, then lands on its profile. */
export async function addClientProfile(formData: FormData): Promise<SubmitResult<NewClientField>> {
  const user = await requireRole(["closer"]);
  const parsed = parseNewClient(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  let id: string;
  try {
    id = await createClientProfile(parsed.value, user.id);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client create failed", { service: error.service, error });
    return { ok: false, message: "We couldn't add this client just now. Please try again in a moment." };
  }

  redirect(closerClientHref(id));
}

export async function saveClientDetails(formData: FormData): Promise<SubmitResult<ClientDetailField>> {
  await requireRole(["admin"]);
  const parsed = parseClientDetails(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    if (!(await updateClientDetails(parsed.value))) return { ok: false, message: "That client no longer exists. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client details save failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save these details just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** A note on the client, with an optional file. */
export async function saveClientNote(formData: FormData): Promise<SubmitResult<ClientNoteField>> {
  await requireRole(["admin"]);
  const file = formData.get("attachment");
  const title = formData.get("attachmentName");
  const entries = formEntries(formData);
  delete entries.attachment;
  delete entries.attachmentName;
  const parsed = parseClientNote(entries);
  if (!parsed.ok) return toSubmitResult(parsed);

  let attachment: { name: string; type: string; base64: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const named = typeof title === "string" ? title : "";
    const accepted = acceptClientAttachment(file, named);
    if (!accepted.ok) return { ok: false, message: accepted.message };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = acceptClientAttachment({ name: file.name, type: file.type, size: bytes.byteLength }, named);
    if (!checked.ok) return { ok: false, message: checked.message };
    attachment = { name: checked.name, type: checked.type, base64: Buffer.from(bytes).toString("base64") };
  }

  try {
    const result = await addClientNote(parsed.value, attachment);
    if (!result.ok) return { ok: false, message: "That client no longer exists. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client note failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save that note just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** Hides the client from the list, or puts them back. The record stays. */
export async function setClientPaused(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseClientFlag(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    if (!(await pauseClient(parsed.value.clientId, parsed.value.disabled))) return { ok: false, message: "That client no longer exists. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client disable failed", { service: error.service, error });
    return { ok: false, message: "We couldn't update this client just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}
