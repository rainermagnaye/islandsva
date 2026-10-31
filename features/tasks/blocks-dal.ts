import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { isUuid } from "@/lib/uuid";
import type { CalendarBlock } from "./contract";

// A VA's calendar blocks, read and written as the signed-in VA: RLS shows only their own, and the fill trigger
// sets the owner and checks a task block is on their own open task (IVA47).

type BlockRow = {
  id: string;
  task_id: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  task: { title: string; company_name: string } | null;
};

/** The VA's blocks ending after `since`, soonest first. */
export async function listBlocks(vaId: string, since: Date): Promise<CalendarBlock[]> {
  if (!isUuid(vaId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_blocks")
    .select("id, task_id, title, starts_at, ends_at, task:tasks(title, company_name)")
    .eq("va_id", vaId)
    .gt("ends_at", since.toISOString())
    .order("starts_at")
    .limit(500);
  if (error) throw new UpstreamError("supabase", `Listing calendar blocks failed (${error.code})`);
  return ((data ?? []) as unknown as BlockRow[]).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    title: row.task?.title ?? row.title ?? "Blocked time",
    companyName: row.task?.company_name ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}

export type BlockWrite = { ok: true } | { ok: false; reason: "task" | "not_allowed" };

export async function insertBlock(input: { taskId: string | null; title: string | null; startsAt: string; endsAt: string }): Promise<BlockWrite> {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_blocks").insert({ task_id: input.taskId, title: input.title, starts_at: input.startsAt, ends_at: input.endsAt });
  if (!error) return { ok: true };
  if (error.code === "IVA47") return { ok: false, reason: "task" };
  if (error.code === "42501" || error.code === "23514") return { ok: false, reason: "not_allowed" };
  throw new UpstreamError("supabase", `Adding a calendar block failed (${error.code})`);
}

/** False when there was nothing of the VA's to remove. */
export async function deleteBlock(blockId: string): Promise<boolean> {
  if (!isUuid(blockId)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_blocks").delete().eq("id", blockId).select("id");
  if (error) throw new UpstreamError("supabase", `Removing a calendar block failed (${error.code})`);
  return (data ?? []).length > 0;
}

/** The zone of a client the VA is assigned to (RLS shows only those), or null. */
export async function assignedClientZone(clientId: string): Promise<{ timezone: string | null } | null> {
  if (!isUuid(clientId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("timezone").eq("id", clientId).maybeSingle();
  if (error) throw new UpstreamError("supabase", `Reading a client's time zone failed (${error.code})`);
  return data ? { timezone: data.timezone } : null;
}
