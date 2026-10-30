import "server-only";
import { createHash } from "node:crypto";

/** SHA-256 (hex) of an agreement's text: the page's fingerprint of what it showed, and the pin on each version. */
export const agreementHash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
