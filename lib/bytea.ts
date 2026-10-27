import "server-only";

/**
 * A Postgres `bytea` column as PostgREST returns it: `\x`-prefixed hex, bare hex, or base64. Every feature
 * that serves a stored file (attachments, résumés, photos, payment proofs) reads its bytes through this.
 */
export function decodeBytea(value: string) {
  const hex = value.startsWith("\\x") ? value.slice(2) : /^[0-9a-fA-F]+$/.test(value) ? value : "";
  if (hex && hex.length % 2 === 0) return Uint8Array.from(Buffer.from(hex, "hex"));
  return Uint8Array.from(Buffer.from(value, "base64"));
}
