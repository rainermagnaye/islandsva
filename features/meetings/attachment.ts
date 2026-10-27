/** Same ceiling as a client note. A larger file has to stay out of the form: the action body stops at 3 MB. */
export const BOOKING_ATTACHMENT_BYTES = 2_097_152;

const TYPES: Record<string, readonly string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a", ".mp4"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/webm": [".webm"],
  "audio/ogg": [".ogg"],
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

/** The `accept` list for the file picker. */
export const BOOKING_ATTACHMENT_ACCEPT = Object.entries(TYPES)
  .flatMap(([type, extensions]) => [type, ...extensions])
  .join(",");

const TOO_BIG = "Keep the attachment under 2 MB.";
const WRONG_TYPE = "Use an MP3, M4A, WAV, WebM, PDF, JPG or PNG.";

/** The stored name: the name typed in the form, with the file's own extension kept. */
export function attachmentName(typed: string, extension: string) {
  const stem = typed.trim().replace(/[^\w.\- ()]+/g, "").replace(/\.[^.]+$/, "").trim();
  return `${stem || "attachment"}${extension}`.slice(0, 200);
}

/** Whether an optional attachment can be stored. Empty files are handled by the caller. */
export function acceptBookingAttachment(file: { name: string; type: string; size: number }, title = ""):
  | { ok: true; name: string; type: string }
  | { ok: false; message: string } {
  if (file.size > BOOKING_ATTACHMENT_BYTES) return { ok: false, message: TOO_BIG };
  if (file.size < 1) return { ok: false, message: "That file is empty." };
  const extensions = TYPES[file.type];
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!extensions?.includes(extension)) return { ok: false, message: WRONG_TYPE };
  return { ok: true, name: attachmentName(title || file.name, extension), type: file.type === "audio/x-wav" ? "audio/wav" : file.type };
}
