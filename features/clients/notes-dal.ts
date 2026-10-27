import "server-only";
import { decodeBytea } from "@/lib/bytea";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { ClientNote } from "./contract";

// A client's append-only notes and their files, as the signed-in admin: record_client_note checks the client,
// and RLS covers the reads.

const NOTE_REFUSALS = { IVA01: "not_found" } as const;

/** Notes newest first, with the author's name when this admin can read the profile. */
export async function listClientNotes(clientId: string): Promise<ClientNote[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_notes")
    .select("id, body, author_id, created_at, attachment_name, attachment_type")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new UpstreamError("supabase", `Reading notes for ${clientId} failed: ${error.message}`, { cause: error });
  const names = await authorNames(data.map((row) => row.author_id));
  return data.map((row) => ({
    id: row.id,
    body: row.body,
    authorName: names.get(row.author_id) ?? "Team member",
    createdAt: row.created_at,
    attachmentName: row.attachment_name,
    attachmentType: row.attachment_type,
  }));
}

async function authorNames(ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (error) throw new UpstreamError("supabase", `Reading note authors failed: ${error.message}`, { cause: error });
  return new Map(data.map((row) => [row.id, row.full_name]));
}

/** A note, plus an optional file, on the client. */
export async function recordClientNote(clientId: string, body: string, file: { name: string; type: string; base64: string } | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_client_note", {
    client_id: clientId,
    body,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  if (error) {
    const refusal = NOTE_REFUSALS[error.code as keyof typeof NOTE_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Recording a client note failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const };
}

/** The file on one note, for an admin who can already read that client. */
export async function getClientNoteAttachment(clientId: string, noteId: string) {
  if (!isUuid(clientId) || !isUuid(noteId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_notes")
    .select("attachment_name, attachment_type, attachment_bytes")
    .eq("id", noteId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading a client attachment failed: ${error.message}`, { cause: error });
  if (!data?.attachment_name || !data.attachment_type || !data.attachment_bytes) return null;
  return { name: data.attachment_name, type: data.attachment_type, bytes: decodeBytea(data.attachment_bytes) };
}
