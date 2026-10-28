import "server-only";
import { acceptClientAttachment } from "@/features/clients/attachment";
import { TASK_LIMITS } from "./contract";

// Files posted to a task action. A bad file is refused with a message, never thrown: the caller returns it.

export type StoredFile = { name: string; contentType: string; bytes: Uint8Array };

/** Checks each file's size and type before and after reading it, and the total against the action body limit. */
export async function readFiles(files: readonly File[]): Promise<{ ok: true; files: StoredFile[] } | { ok: false; message: string }> {
  if (files.length > TASK_LIMITS.attachments) return { ok: false, message: `Attach up to ${TASK_LIMITS.attachments} files.` };
  const stored: StoredFile[] = [];
  let total = 0;
  for (const file of files) {
    total += file.size;
    if (total > 2_097_152) return { ok: false, message: "Keep the attachments under 2 MB in total." };
    const accepted = acceptClientAttachment({ name: file.name, type: file.type || "application/octet-stream", size: file.size });
    if (!accepted.ok) return { ok: false, message: accepted.message };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = acceptClientAttachment({ name: file.name, type: file.type || "application/octet-stream", size: bytes.byteLength });
    if (!checked.ok) return { ok: false, message: checked.message };
    stored.push({ name: checked.name, contentType: checked.type, bytes });
  }
  return { ok: true, files: stored };
}
