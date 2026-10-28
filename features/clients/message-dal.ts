import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";

// Reads and writes run as the signed-in user, so RLS checks again. IVA23, IVA24 and IVA35 are the
// message trigger's refusals. The body is never written to the log.

export type VaMessage = { id: string; authorId: string; body: string; createdAt: string };

const REFUSED = new Set(["IVA23", "IVA24", "IVA35", "42501", "23514"]);

export async function listVaMessages(clientId: string, vaId: string): Promise<VaMessage[]> {
  if (!isUuid(clientId) || !isUuid(vaId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("va_messages")
    .select("id, author_id, body, created_at")
    .eq("client_id", clientId)
    .eq("va_id", vaId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new UpstreamError("supabase", `Reading messages failed (${error.code})`);
  return data
    .map((row) => ({ id: row.id, authorId: row.author_id, body: row.body, createdAt: row.created_at }))
    .reverse();
}

export async function insertVaMessage(input: { clientId: string; vaId: string; authorId: string; body: string }): Promise<{ ok: true } | { ok: false }> {
  const supabase = await createClient();
  const { error } = await supabase.from("va_messages").insert({
    client_id: input.clientId,
    va_id: input.vaId,
    author_id: input.authorId,
    body: input.body,
  });
  if (!error) return { ok: true };
  if (REFUSED.has(error.code)) return { ok: false };
  throw new UpstreamError("supabase", `Sending a message failed (${error.code})`);
}
