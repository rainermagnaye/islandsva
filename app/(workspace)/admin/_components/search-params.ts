// Reading and writing the admin lists' URL state (?status=…&page=…). Untrusted input: anything
// unexpected falls back to the default rather than erroring.

type Param = string | string[] | undefined;

const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

/** `?page=` as a positive integer; anything else is page 1. */
export function pageFrom(value: Param) {
  const page = Number(first(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** `?status=` as one of `options`' keys; anything else (missing, tampered) means "All". */
export function filterFrom<Value extends string>(value: Param, options: Readonly<Record<Value, string>>) {
  const raw = first(value);
  return raw && Object.hasOwn(options, raw) ? (raw as Value) : undefined;
}

/**
 * `?q=` for the lead search. Anything that could change the database filter (wildcards, commas, dots
 * that PostgREST treats as syntax) is dropped; a blank search means no filter.
 */
export function searchFrom(value: Param) {
  const raw = first(value)?.normalize("NFKC").trim() ?? "";
  const safe = raw.replace(/[%_\\,().]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return safe || undefined;
}

/** A list URL keeping the given filters; page 1 and empty values are left out. */
export function listHref(base: string, params: { status?: string; page?: number; q?: string }) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}
