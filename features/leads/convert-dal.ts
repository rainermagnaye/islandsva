import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import type { ConvertNotedInput } from "./convert-validation";

// Converting a lead into a client, as the signed-in admin. convert_lead and convert_lead_noted lock the lead
// and refuse a converted or closed one in the same transaction.

/** Why a conversion was refused, from convert_lead()'s own error codes (see the migration). */
const CONVERT_REFUSALS = { IVA01: "not_found", IVA02: "converted", IVA03: "closed" } as const;

/** Creates a pending client from a lead and marks the lead converted, in one database transaction. */
export async function convertLeadToClient(input: { leadId: string; companyName: string; contactName: string; contactPhone: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_lead", {
    lead_id: input.leadId,
    company_name: input.companyName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
  });
  if (error) {
    const refusal = CONVERT_REFUSALS[error.code as keyof typeof CONVERT_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    throw new UpstreamError("supabase", `Converting lead ${input.leadId} failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, clientId: data };
}

/** Converts the lead, stores the confirmed package on the client, and writes the remark. */
export async function convertLeadNoted(input: ConvertNotedInput & { monthlyCents: number; timezone: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_lead_noted", {
    lead_id: input.leadId,
    company_name: input.companyName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    remarks: input.remarks,
    package_code: input.packageSlug,
    hours_per_week: input.hoursPerWeek,
    term_months: input.termMonths,
    monthly_cents: input.monthlyCents,
    starts_on: input.startsOn,
    timezone: input.timezone,
  });
  if (error) {
    const refusal = CONVERT_REFUSALS[error.code as keyof typeof CONVERT_REFUSALS];
    if (refusal) return { ok: false as const, reason: refusal };
    if (error.code === "IVA04") return { ok: false as const, reason: "unavailable" as const };
    throw new UpstreamError("supabase", `Converting lead ${input.leadId} failed: ${error.message}`, { cause: error });
  }
  return { ok: true as const, clientId: data };
}
