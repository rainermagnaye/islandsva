import "server-only";
import { decodeBytea } from "@/lib/bytea";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { LeadEventKind } from "./contract";

// Timeline writes (steps, calls and notes) and their files, as the signed-in admin: the functions check the
// lead and the role, and RLS covers the reads.

const STEP_REFUSALS = { IVA01: "not_found", IVA04: "unavailable" } as const;

/** Writes a timeline row and, for a pipeline step, moves the status. One database transaction. */
export async function recordLeadStep(leadId: string, kind: LeadEventKind, body: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_lead_step", { lead_id: leadId, kind, body });
  if (error) {
    const refusal = STEP_REFUSALS[error.code as keyof typeof STEP_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Recording a lead step failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/**
 * Book demo (new → contacted) or Qualified (contacted → qualified) for a lead the caller already proved they
 * own. The step function and the update policy are admin-only, so this uses the secret key. The status filter
 * and closer id are checked again here so a mismatched lead is left unchanged.
 */
export async function recordOwnedLeadStep(authorId: string, leadId: string, kind: "call" | "qualification", body: string) {
  const from = kind === "call" ? "new" : "contacted";
  const next = kind === "call" ? "contacted" : "qualified";
  const admin = createAdminClient();
  const { data, error } = await admin.from("leads").update({ status: next }).eq("id", leadId).eq("closer_id", authorId).eq("status", from).is("disabled_at", null).select("id");
  if (error) throw new UpstreamError("supabase", `Recording a lead step failed: ${error.message}`, { cause: error });
  if ((data ?? []).length === 0) return { ok: false as const, reason: "unavailable" as const };

  const { error: eventError } = await admin.from("lead_events").insert({ lead_id: leadId, author_id: authorId, kind, body: body.trim() });
  if (eventError) {
    await admin.from("leads").update({ status: from }).eq("id", leadId).eq("closer_id", authorId).eq("status", next);
    throw new UpstreamError("supabase", `Recording a lead step failed: ${eventError.message}`, { cause: eventError });
  }
  return { ok: true as const };
}

/** Call summary or note, plus an optional file. A call moves the lead to contacted; a note leaves the status. */
export async function recordLeadFile(kind: "call" | "note", leadId: string, body: string, file: { name: string; type: string; base64: string } | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(kind === "call" ? "record_lead_call" : "record_lead_note", {
    lead_id: leadId,
    body,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  if (error) {
    const refusal = STEP_REFUSALS[error.code as keyof typeof STEP_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Recording a call failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/** The file on one timeline row, for an admin who can already read that lead. */
export async function getLeadAttachment(leadId: string, eventId: string) {
  if (!isUuid(leadId) || !isUuid(eventId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_events")
    .select("attachment_name, attachment_type, attachment_bytes")
    .eq("id", eventId)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading an attachment failed: ${error.message}`, { cause: error });
  if (!data?.attachment_name || !data.attachment_type || !data.attachment_bytes) return null;
  return { name: data.attachment_name, type: data.attachment_type, bytes: decodeBytea(data.attachment_bytes) };
}
