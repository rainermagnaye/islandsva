"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { closerClientHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { FIELD_ERRORS, formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { ClientDetailField, ClientNoteField, CreateClientField, NewClientField, PaymentReceivedField, VaMessageField } from "./contract";
import { acceptClientAttachment } from "./attachment";
import { registrationOrigin } from "./link";
import { addClientNote, confirmClientReviewPaid, createClientProfile, createClientRecord, openOnboardingLink, pauseClient, returnClientReview, sendClientActivation as sendActivation, updateClientDetails } from "./service";
import { listActiveAssignments } from "./assignment-dal";
import { getOwnClientId } from "./dal";
import { insertVaMessage } from "./message-dal";
import { parseClientReview, parseNewClient, parsePaymentReceived } from "./review-validation";
import { parseClientDetails, parseClientFlag, parseClientId, parseClientNote, parseCreateClient, parseVaMessage } from "./validation";

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

/** A client added on the list, with no lead. They stay pending until registration. */
export async function addClient(formData: FormData): Promise<SubmitResult<CreateClientField>> {
  const user = await requireRole(["admin"]);
  const parsed = parseCreateClient(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    await createClientRecord(parsed.value, user.id);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Creating a client failed", { service: error.service, error });
    return { ok: false, message: "We couldn't add this client just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
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

/**
 * Creates the registration link for a client that does not have one yet. The client's Closer may too:
 * openOnboardingLink reads the client under RLS first (a Closer sees only the clients they created), and only
 * then stores the link with the secret key.
 */
export async function generateOnboardingLink(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin", "closer"]);
  const parsed = parseClientId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await openOnboardingLink(parsed.value.clientId);
    if (!result.ok) {
      return {
        ok: false,
        message: result.reason === "exists"
          ? "This client already has a registration link. Refresh the page."
          : "That client no longer exists. Refresh the page.",
      };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Registration link failed", { service: error.service, error });
    return { ok: false, message: "We couldn't create the registration link just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

const APPROVAL_REFUSED = {
  not_allowed: { message: "Only an admin of this agency can confirm registrations." },
  invalid: { message: "That amount, fee or date can't be recorded. Check them and try again." },
  reference_used: { field: "This reference is already recorded for another payment." },
  reference_missing: { field: "Enter the payment reference." },
  agreement_missing: { message: "The client must accept the current agreement before you approve. Send the Agreement back to them." },
} as const;

const INVITE_NOT_SENT = "Payment verified, but the invite wasn't sent. Use Send activation to try again.";

/**
 * "Approve and send invite": approves the packet and records the payment (one database transaction), then sends the
 * password invite. The actor is the signed-in admin, never a form field. If the invite fails the client stays
 * approved: the profile shows Send activation, and this returns a message saying so.
 */
export async function confirmClientRegistration(formData: FormData): Promise<SubmitResult<PaymentReceivedField>> {
  const user = await requireRole(["admin"]);
  const parsed = parsePaymentReceived(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await confirmClientReviewPaid(parsed.value, user.id);
    if (!result.ok) {
      const refused = Object.hasOwn(APPROVAL_REFUSED, result.reason) ? APPROVAL_REFUSED[result.reason as keyof typeof APPROVAL_REFUSED] : null;
      if (refused && "field" in refused) return { ok: false, message: FIELD_ERRORS, fieldErrors: { reference: refused.field } };
      return { ok: false, message: refused?.message ?? "This registration is not in review. Refresh the page." };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client review failed", { service: error.service, error });
    return { ok: false, message: "We couldn't confirm this registration just now. Please try again in a moment." };
  }

  let invited = false;
  try {
    invited = (await sendActivation(parsed.value.clientId, user.id, await registrationOrigin())).ok;
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client invite after approval failed", { service: error.service, error: error.message });
  }

  refresh();
  return invited ? { ok: true } : { ok: false, message: INVITE_NOT_SENT };
}

/** Sends the registration back to the sections that need a change. */
export async function returnClientRegistration(formData: FormData): Promise<SubmitResult<"note" | "sections">> {
  await requireRole(["admin"]);
  const parsed = parseClientReview({
    clientId: formData.get("clientId"),
    note: formData.get("note") ?? "",
    sections: formData.getAll("section").map(String),
  });
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await returnClientReview(parsed.value);
    if (!result.ok) return { ok: false, message: "This registration is not in review. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client return failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send that registration back. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** Emails the password link once the review is accepted. */
export async function sendClientActivation(formData: FormData): Promise<SubmitResult> {
  const admin = await requireRole(["admin"]);
  const parsed = parseClientId(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await sendActivation(parsed.value.clientId, admin.id, await registrationOrigin());
    if (!result.ok) {
      if (result.reason === "rate") return { ok: false, message: "Too many invitation emails were sent. Wait a while, then try again." };
      if (result.reason === "exists") return { ok: false, message: "That email already has an account." };
      if (result.reason === "redirect") return { ok: false, message: "We couldn't send the activation link. Please try again in a moment." };
      return { ok: false, message: "This client is not ready for activation. Refresh the page." };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client activation failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send the activation link just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** The client leaves a note for one VA they are working with. */
export async function sendVaMessage(formData: FormData): Promise<SubmitResult<VaMessageField>> {
  const user = await requireRole(["client"]);
  const parsed = parseVaMessage(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const clientId = await getOwnClientId(user.id);
    const assignments = clientId ? await listActiveAssignments(clientId) : [];
    if (!clientId || !assignments.some((assignment) => assignment.vaId === parsed.value.vaId)) {
      return { ok: false, message: "That message needs an active assignment with your VA." };
    }
    const sent = await insertVaMessage({ clientId, vaId: parsed.value.vaId, authorId: user.id, body: parsed.value.body });
    if (!sent.ok) return { ok: false, message: "That message couldn't be sent." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("VA message failed", { service: error.service, error });
    return { ok: false, message: "We couldn't send that message just now. Please try again in a moment." };
  }
  refresh();
  return { ok: true };
}
