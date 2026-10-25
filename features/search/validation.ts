import "server-only";
import { z } from "zod";

const schema = z.strictObject({
  q: z.string().max(80),
});

/** Drops characters PostgREST treats as filter syntax, then trims. */
export function searchTerm(raw: string) {
  return raw.normalize("NFKC").replace(/[%_\\,()."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** The `q` query. A term shorter than three characters is returned as an empty string. */
export function parseSearchQuery(input: unknown): { ok: true; term: string } | { ok: false; formError: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, formError: "That search couldn't be read." };
  return { ok: true, term: searchTerm(parsed.data.q) };
}
