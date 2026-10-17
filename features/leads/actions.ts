"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";
import { formEntries, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { ConvertField, LeadEditField, LeadField, LeadStatusField } from "./contract";
import { acceptLeadAttachment } from "./attachment";
import { convertLead as convert, convertLeadWithRemarks, createLead, editLead, logLeadFile, logLeadStep, pauseLead, removeLead, setLeadStatus } from "./service";
import { parseAdminLead, parseConvert, parseConvertNoted, parseLeadEdit, parseLeadFlag, parseLeadStatus, parseLeadStep, parseLeadTarget, type ConvertNotedField, type LeadStepField } from "./validation";

// Public POST endpoints: each re-checks the caller's role (admin with two-factor sign-in) itself.

const REFUSED = {
  not_found: "That lead no longer exists. Refresh the page.",
  converted: "This lead has already been converted to a client.",
  closed: "This lead is closed, so it can't be converted.",
} as const;

export async function convertLead(formData: FormData): Promise<SubmitResult<ConvertField>> {
  await requireRole(["admin"]);
  const parsed = parseConvert(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await convert(parsed.value);
    if (!result.ok) return { ok: false, message: REFUSED[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead conversion failed", { service: error.service, error });
    return { ok: false, message: "We couldn't convert this lead just now. Please try again in a moment." };
  }

  refresh(); // re-render the lead list and stats in the same round trip
  return { ok: true };
}

/** An admin adds a lead that didn't come through the discovery form. Stored the same way, with no visitor IP. */
export async function addLead(formData: FormData): Promise<SubmitResult<LeadField>> {
  await requireRole(["admin"]);
  const parsed = parseAdminLead(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    await createLead(parsed.value, { ipHash: null, userAgent: null });
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Creating a lead failed", { service: error.service, error });
    return { ok: false, message: "We couldn't add this lead just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function changeLeadStatus(formData: FormData): Promise<SubmitResult<LeadStatusField>> {
  await requireRole(["admin"]);
  const parsed = parseLeadStatus(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    if (!(await setLeadStatus(parsed.value))) {
      refresh(); // show what the lead is now
      return { ok: false, message: "This lead changed since the page loaded. Check its status and try again." };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead status change failed", { service: error.service, error });
    return { ok: false, message: "We couldn't update this lead just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

const STEP_REFUSED = {
  not_found: "That lead no longer exists. Refresh the page.",
  unavailable: "That step isn't available for this lead anymore. Refresh the page.",
} as const;

/** Call summary, qualification, junk remark, note or remark. The database moves the status when the kind is a step. */
export async function saveLeadStep(formData: FormData): Promise<SubmitResult<LeadStepField>> {
  await requireRole(["admin"]);
  const file = formData.get("attachment");
  const title = formData.get("attachmentName");
  const entries = formEntries(formData);
  delete entries.attachment;
  delete entries.attachmentName;
  const parsed = parseLeadStep(entries);
  if (!parsed.ok) return toSubmitResult(parsed);

  let attachment: { name: string; type: string; base64: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (parsed.value.kind !== "call" && parsed.value.kind !== "note") return { ok: false, message: "Something went wrong with the form. Please refresh the page and try again." };
    const named = typeof title === "string" ? title : "";
    const accepted = acceptLeadAttachment(file, named);
    if (!accepted.ok) return { ok: false, message: accepted.message };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = acceptLeadAttachment({ name: file.name, type: file.type, size: bytes.byteLength }, named);
    if (!checked.ok) return { ok: false, message: checked.message };
    attachment = { name: checked.name, type: checked.type, base64: Buffer.from(bytes).toString("base64") };
  }

  try {
    const result = attachment && (parsed.value.kind === "call" || parsed.value.kind === "note")
      ? await logLeadFile(parsed.value.kind, parsed.value.leadId, parsed.value.body, attachment)
      : await logLeadStep(parsed.value);
    if (!result.ok) return { ok: false, message: STEP_REFUSED[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead timeline write failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save that just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

/** Convert, with the remarks stored on the timeline in the same transaction. */
export async function convertLeadNoted(formData: FormData): Promise<SubmitResult<ConvertNotedField>> {
  await requireRole(["admin"]);
  const parsed = parseConvertNoted(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await convertLeadWithRemarks(parsed.value);
    if (!result.ok) return { ok: false, message: result.reason === "unavailable" ? STEP_REFUSED.unavailable : REFUSED[result.reason] };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead conversion failed", { service: error.service, error });
    return { ok: false, message: "We couldn't convert this lead just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function saveLeadDetails(formData: FormData): Promise<SubmitResult<LeadEditField>> {
  await requireRole(["admin"]);
  const parsed = parseLeadEdit(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    if (!(await editLead(parsed.value))) return { ok: false, message: "That lead no longer exists. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead edit failed", { service: error.service, error });
    return { ok: false, message: "We couldn't save these details just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function setLeadPaused(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseLeadFlag(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    if (!(await pauseLead(parsed.value.leadId, parsed.value.disabled))) return { ok: false, message: "That lead no longer exists. Refresh the page." };
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead pause failed", { service: error.service, error });
    return { ok: false, message: "We couldn't update this lead just now. Please try again in a moment." };
  }

  refresh();
  return { ok: true };
}

export async function deleteLead(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseLeadTarget(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);

  try {
    const result = await removeLead(parsed.value.leadId);
    if (!result.ok) {
      return {
        ok: false,
        message: result.reason === "history" ? "This lead has history, so it can't be deleted." : "That lead no longer exists. Refresh the page.",
      };
    }
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Lead delete failed", { service: error.service, error });
    return { ok: false, message: "We couldn't delete this lead just now. Please try again in a moment." };
  }

  redirect(appRoutes.adminLeads);
}
