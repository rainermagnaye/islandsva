import "server-only";
import { formEntries } from "@/lib/validation";
import { acceptBookingAttachment } from "./attachment";

// Reading a meeting form's FormData for the admin and client Server Actions: the optional file and the fields.

export type BookingFile = { name: string; type: string; base64: string } | null;

/** The optional file, checked by its header and again by the bytes actually read. */
export async function fileFrom(formData: FormData): Promise<{ ok: true; file: BookingFile } | { ok: false; message: string }> {
  const file = formData.get("attachment");
  const title = formData.get("attachmentName");
  if (!(file instanceof File) || file.size === 0) return { ok: true, file: null };
  const named = typeof title === "string" ? title : "";
  const accepted = acceptBookingAttachment(file, named);
  if (!accepted.ok) return { ok: false, message: accepted.message };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = acceptBookingAttachment({ name: file.name, type: file.type, size: bytes.byteLength }, named);
  if (!checked.ok) return { ok: false, message: checked.message };
  return { ok: true, file: { name: checked.name, type: checked.type, base64: Buffer.from(bytes).toString("base64") } };
}

/** A note form's fields, without the file (read by fileFrom). */
export function noteEntries(formData: FormData) {
  const value = formEntries(formData);
  delete value.attachment;
  delete value.attachmentName;
  return value;
}

/** A meeting form's fields: the invite lists as arrays, without the file. */
export function bookingEntries(formData: FormData) {
  const value = noteEntries(formData);
  const ids = (name: string) => formData.getAll(name).filter((item): item is string => typeof item === "string" && item.length > 0);
  value.clientIds = ids("clientIds");
  value.staffIds = ids("staffIds");
  return value;
}
