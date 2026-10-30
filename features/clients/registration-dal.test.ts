import { beforeEach, describe, expect, it, vi } from "vitest";

// The registration link's reads and writes use the secret key, so the token's shape is checked before anything
// reaches the database, and what an admin reads back about an acceptance leaves the IP hash out.

const supabase = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => supabase);
vi.mock("next/server", () => ({ connection: async () => undefined }));

const { acceptClientAgreementRow, getAgreementReview, getRegistrationState } = await import("./registration-dal");

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK123456";
const terms = { company_name: "Acme", country: null, package_code: "essentials", hours_per_week: 20, term_months: 6, monthly_cents: 85500, starts_on: "2026-11-01" };

beforeEach(() => supabase.createAdminClient.mockReset());

describe("getRegistrationState", () => {
  it.each(["", "short", `${token}x`, `${token.slice(0, 42)}!`, "../../etc/passwd"])("returns null for a malformed token (%s) without a database call", async (bad) => {
    expect(await getRegistrationState(bad)).toBeNull();
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });
});

describe("acceptClientAgreementRow", () => {
  const call = (error: { code: string } | null, data: string | null = null) => {
    supabase.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data, error }) });
    return acceptClientAgreementRow({ token, version: "v1", body: "text", termsSeen: terms, signerName: "Ana", ipHash: null });
  };

  it("maps the database's stale-terms refusal to the same reason as the service's own check", async () => {
    expect(await call({ code: "IVA43" })).toEqual({ ok: false, reason: "changed" });
  });

  it("maps its other refusals and returns the status", async () => {
    expect(await call(null, "pending_review")).toEqual({ ok: true, status: "pending_review" });
    expect(await call({ code: "IVA45" })).toEqual({ ok: false, reason: "terms_missing" });
    expect(await call({ code: "IVA06" })).toEqual({ ok: false, reason: "not_found" });
    expect(await call({ code: "IVA08" })).toEqual({ ok: false, reason: "not_open" });
    expect(await call({ code: "IVA09" })).toEqual({ ok: false, reason: "closed" });
    expect(await call({ code: "23514" })).toEqual({ ok: false, reason: "invalid" });
    await expect(call({ code: "XX000" })).rejects.toThrow(/Accepting the agreement failed/);
  });
});

describe("getAgreementReview", () => {
  const clientId = "0b7c6a52-5a4f-4e0b-9a8e-2b1c3d4e5f60";
  const clientRow = { company_name: "Acme", business: { country: "United States" }, package_code: "essentials", hours_per_week: 20, term_months: 6, monthly_cents: 85500, starts_on: "2026-11-01" };
  const agreementRow = { id: "a1", version: "v1", body: "text", terms, signer_name: "Ana", contact_email_on_file: "ana@x.co", ip_hash: "f".repeat(64), accepted_at: "2026-10-30T00:00:00Z" };

  /** A fake secret-key client: each table answers one row, and every filter is recorded. */
  function fake(rows: Record<string, unknown>) {
    const filters: Record<string, [string, unknown][]> = {};
    supabase.createAdminClient.mockReturnValue({
      from: (table: string) => {
        filters[table] = [];
        const chain = {
          select: () => chain,
          eq: (column: string, value: unknown) => {
            filters[table].push([column, value]);
            return chain;
          },
          maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        };
        return chain;
      },
    });
    return filters;
  }

  it("reads only the acceptance the packet points at, for this client, and says whether an IP was recorded, never the hash", async () => {
    const filters = fake({ client_packets: { agreement_id: "a1", legacy_consent: false }, clients: clientRow, client_agreements: agreementRow });
    const review = await getAgreementReview(clientId);
    expect(filters.client_agreements).toEqual([
      ["id", "a1"],
      ["client_id", clientId],
    ]);
    expect(review).toEqual({
      legacyConsent: false,
      currentTerms: { ...terms, country: "United States" },
      accepted: { id: "a1", version: "v1", body: "text", terms, signerName: "Ana", contactEmailOnFile: "ana@x.co", ipRecorded: true, acceptedAt: "2026-10-30T00:00:00Z" },
    });
    expect(JSON.stringify(review)).not.toContain("f".repeat(64));
  });

  it("doesn't read client_agreements when the packet has no acceptance", async () => {
    const filters = fake({ client_packets: { agreement_id: null, legacy_consent: true }, clients: clientRow });
    expect(await getAgreementReview(clientId)).toMatchObject({ legacyConsent: true, accepted: null });
    expect(filters.client_agreements).toBeUndefined();
  });

  it("returns nothing for a malformed id without a database call", async () => {
    expect(await getAgreementReview("42")).toBeNull();
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });
});
