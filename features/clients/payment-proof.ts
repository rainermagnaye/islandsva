/** Same ceiling as a note file. A larger proof has to stay out of the form: the action body stops at 3 MB. */
export const PAYMENT_PROOF_BYTES = 2_097_152;

const TYPES: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

/** The `accept` list for the file picker. */
export const PAYMENT_PROOF_ACCEPT = Object.entries(TYPES)
  .flatMap(([type, extensions]) => [type, ...extensions])
  .join(",");

const TOO_BIG = "Keep the payment proof under 2 MB.";
const WRONG_TYPE = "Use a PDF, JPG, PNG or WebP.";

function storedName(filename: string, extension: string) {
  const stem = filename.trim().replace(/[^\w.\- ()]+/g, "").replace(/\.[^.]+$/, "").trim();
  return `${stem || "payment"}${extension}`.slice(0, 200);
}

/** Whether a payment file can be stored. The caller treats a missing file as its own error. */
export function acceptPaymentProof(file: { name: string; type: string; size: number }):
  | { ok: true; name: string; type: string }
  | { ok: false; message: string } {
  if (file.size > PAYMENT_PROOF_BYTES) return { ok: false, message: TOO_BIG };
  if (file.size < 1) return { ok: false, message: "That file is empty." };
  const extensions = TYPES[file.type];
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!extensions?.includes(extension)) return { ok: false, message: WRONG_TYPE };
  return { ok: true, name: storedName(file.name, extension), type: file.type };
}
