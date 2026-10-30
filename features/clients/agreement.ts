import { AGREEMENTS, type AgreementVersion } from "@/content/agreement";
import { packages } from "@/content/packages";

// The agreement's terms and text: pure rules shared by the registration page and the server. No Zod, no server-only.

/**
 * The terms an acceptance covers. Same keys and value types as private.client_agreement_terms (20261029172015), so
 * the JSON the app sends equals the database's snapshot (jsonb equality): `country` is the raw `business.country`
 * (null when the key is absent), `starts_on` the `YYYY-MM-DD` date.
 */
export type AgreementTerms = {
  company_name: string;
  country: string | null;
  package_code: string | null;
  hours_per_week: number | null;
  term_months: number | null;
  monthly_cents: number | null;
  starts_on: string | null;
};

const TERM_KEYS = ["company_name", "country", "package_code", "hours_per_week", "term_months", "monthly_cents", "starts_on"] as const satisfies readonly (keyof AgreementTerms)[];

/** Builds the terms from client fields; `countryOnFile` is the stored business country, unnormalised. */
export function agreementTerms(client: {
  companyName: string;
  countryOnFile: string | null;
  packageCode: string | null;
  hoursPerWeek: number | null;
  termMonths: number | null;
  monthlyCents: number | null;
  startsOn: string | null;
}): AgreementTerms {
  return {
    company_name: client.companyName,
    country: client.countryOnFile ?? null,
    package_code: client.packageCode ?? null,
    hours_per_week: client.hoursPerWeek ?? null,
    term_months: client.termMonths ?? null,
    monthly_cents: client.monthlyCents ?? null,
    starts_on: client.startsOn ?? null,
  };
}

/** Reads a stored snapshot (jsonb), or null when it isn't one. */
export function agreementTermsFrom(value: unknown): AgreementTerms | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : null);
  const whole = (key: string) => (typeof record[key] === "number" ? (record[key] as number) : null);
  return {
    company_name: text("company_name") ?? "",
    country: text("country"),
    package_code: text("package_code"),
    hours_per_week: whole("hours_per_week"),
    term_months: whole("term_months"),
    monthly_cents: whole("monthly_cents"),
    starts_on: text("starts_on"),
  };
}

/** Whether two snapshots cover the same terms (as the database compares them). */
export const sameAgreementTerms = (a: AgreementTerms, b: AgreementTerms) => TERM_KEYS.every((key) => a[key] === b[key]);

/** True while something the agreement needs is unset; the database refuses to accept it then (IVA45). */
export function agreementMissingTerms(terms: AgreementTerms) {
  return (
    terms.company_name === null ||
    terms.package_code === null ||
    terms.monthly_cents === null ||
    terms.term_months === null ||
    terms.hours_per_week === null ||
    terms.starts_on === null
  );
}

const NOT_SET = "(not set)";

/** USD without Intl, so the text never changes with the runtime's locale data: 85500 → "USD 855.00". */
function usd(cents: number) {
  const whole = Math.floor(Math.abs(cents) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `USD ${cents < 0 ? "-" : ""}${whole}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
}

function placeholders(terms: AgreementTerms): Record<string, string> {
  const pkg = packages.find((item) => item.slug === terms.package_code);
  return {
    company: terms.company_name || NOT_SET,
    country: terms.country?.trim() || NOT_SET,
    package: pkg?.name ?? terms.package_code ?? NOT_SET,
    hours: terms.hours_per_week === null ? NOT_SET : String(terms.hours_per_week),
    term: terms.term_months === null ? NOT_SET : terms.term_months === 1 ? "1 month" : `${terms.term_months} months`,
    monthly: terms.monthly_cents === null ? NOT_SET : usd(terms.monthly_cents),
    start: terms.starts_on ?? NOT_SET,
  };
}

/**
 * The agreement as plain text: the version's template with the terms filled in, NFC-normalised. Deterministic —
 * no clock, no locale — so the same version and terms always give the same text (and the same hash).
 */
export function renderAgreement(version: AgreementVersion, terms: AgreementTerms) {
  const template = AGREEMENTS[version];
  const values = placeholders(terms);
  const fill = (line: string) => line.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
  const sections = template.sections.map((section, index) => [`${index + 1}. ${section.heading}`, ...section.paragraphs.map(fill)].join("\n"));
  return [template.title, ...sections].join("\n\n").normalize("NFC");
}

/** Where a packet in review stands on the agreement, by the rule approve_client_payment applies (IVA43). */
export type AgreementReviewState = "current" | "stale" | "legacy" | "missing";

/**
 * `current`: the packet's acceptance covers the client's terms now. `stale`: it was accepted, but the company,
 * country or package has changed since. `legacy`: signed with the earlier consent form and never accepted since (the
 * earlier consent counts only while there's no acceptance). `missing`: neither. Only `current` and `legacy` approve.
 */
/** Only an acceptance of the current terms, or the earlier consent with no acceptance since, can be approved. */
export const agreementApprovable = (state: AgreementReviewState | null | undefined) => state === "current" || state === "legacy";

export function agreementReviewState(input: { legacyConsent: boolean; acceptedTerms: AgreementTerms | null; currentTerms: AgreementTerms }): AgreementReviewState {
  if (input.acceptedTerms) return sameAgreementTerms(input.acceptedTerms, input.currentTerms) ? "current" : "stale";
  return input.legacyConsent ? "legacy" : "missing";
}
