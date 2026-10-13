import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpstreamError } from "@/lib/upstream-error";
import type { LeadInput } from "./validation";

type NewLead = LeadInput & { ipHash: string | null; userAgent: string | null };

// Secret-key client: the visitor is anonymous and leads are server-only (no RLS policies). The route has
// already validated the input and passed the anti-spam checks.

export async function insertLead(lead: NewLead): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("leads")
    .insert({
      full_name: lead.name,
      email: lead.email,
      company_name: lead.company,
      message: lead.message,
      package_code: lead.packageSlug,
      ip_hash: lead.ipHash,
      user_agent: lead.userAgent,
    })
    .select("id")
    .single();
  if (error) throw new UpstreamError("supabase", `Insert into leads failed: ${error.message}`, { cause: error });
  return data.id;
}

export async function markLeadNotified(id: string) {
  const { error } = await createAdminClient().from("leads").update({ notified_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new UpstreamError("supabase", `Marking lead ${id} notified failed: ${error.message}`, { cause: error });
}
