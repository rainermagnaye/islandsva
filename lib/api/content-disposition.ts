import "server-only";

/**
 * A Content-Disposition header that survives any file name (RFC 6266 / RFC 8187). Header values must be
 * Latin-1, so a name like "履歴書.pdf" or one with an emoji used to throw and turn a download into an error page.
 * `filename` carries a plain-ASCII fallback; `filename*` carries the real name, UTF-8 percent-encoded, which
 * every current browser prefers.
 */
export function contentDisposition(name: string, disposition: "inline" | "attachment" = "inline") {
  const clean = name.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim() || "file";
  const ascii =
    clean
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .trim() || "file";
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
