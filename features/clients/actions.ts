"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { closerClientHref } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { ClientDetailField, ClientNoteField, CreateClientField, NewClientField, OnboardingField, PaymentReceivedField, VaMessageField } from "./contract";
import { acceptClientAttachment } from "./attachment";
import { acceptPaymentProof } from "./payment-proof";
import { registrationOrigin } from "./link";
import { addClientNote, confirmClientReviewPaid, createClientProfile, createClientRecord, openOnboardingLink, pauseClient, returnClientReview, sendClientActivation as sendActivation, submitOnboarding, updateClientDetails } from "./service";
import { listActiveAssignments } from "./assignment-dal";
import { getOwnClientId } from "./dal";
import { insertVaMessage } from "./message-dal";
import { parseClientReview, parseNewClient, parsePaymentReceived } from "./review-validation";
import { parseClientDetails, parseClientFlag, parseClientId, parseClientNote, parseCreateClient, parseOnboarding, parseVaMessage } from "./validation";

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

/** Accepts the registration and records the payment received (the proof is in the packet). */
export async function confirmClientRegistration(formData: FormData): Promise<SubmitResult<PaymentReceivedField>> {
  const user = await requireRole(["admin"]);
  const parsed = parsePaymentReceived(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await confirmClientReviewPaid(parsed.value, user.id);
    if (!result.ok) {
      const message =
        result.reason === "not_allowed"
          ? "Only an admin of this agency can confirm registrations."
          : result.reason === "invalid"
            ? "That amount, fee or date can't be recorded. Check them and try again."
            : "This registration is not in review. Refresh the page.";
      return { ok: false, message };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client review failed", { service: error.service, error });
    return { ok: false, message: "We couldn't confirm this registration just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
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

const PACKET_REFUSED = {
  not_found: "This registration link is not valid.",
  submitted: "This registration has already been submitted.",
  closed: "This registration is closed.",
  exists: "This registration link is not valid.",
} as const;

/**
 * The customer has no account. The token in the form is the access, checked again by the database.
 * A filled honeypot reports success and stores nothing.
 */
export async function saveOnboarding(formData: FormData): Promise<SubmitResult<OnboardingField>> {
  const fax = formData.get("fax");
  if (typeof fax === "string" && fax.trim() !== "") return { ok: true };

  const file = formData.get("proof");
  const entries = formEntries(formData);
  delete entries.proof;
  delete entries.fax;
  const parsed = parseOnboarding(entries);
  if (!parsed.ok) return toSubmitResult(parsed);

  let proof: { name: string; type: string; base64: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const accepted = acceptPaymentProof(file);
    if (!accepted.ok) return { ok: false, message: accepted.message };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = acceptPaymentProof({ name: file.name, type: file.type, size: bytes.byteLength });
    if (!checked.ok) return { ok: false, message: checked.message };
    proof = { name: checked.name, type: checked.type, base64: Buffer.from(bytes).toString("base64") };
  }

  try {
    const result = await submitOnboarding(parsed.value, proof);
    if (!result.ok) return { ok: false, message: "message" in result ? result.message : PACKET_REFUSED[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Registration packet failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save this registration just now. Please try again in a moment." };
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
