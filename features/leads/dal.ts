import "server-only";
import { UpstreamError } from "@/lib/upstream-error";
import { supabaseRest } from "@/lib/supabase/rest";
import type { LeadInput } from "./validation";

type NewLead = LeadInput & { ipHash: string | null; userAgent: string | null };

export async function insertLead(lead: NewLead): Promise<string> {
  const res = await supabaseRest("leads?select=id", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      name: lead.name,
      email: lead.email,
      company: lead.company,
      message: lead.message,
      package: lead.packageSlug,
      ip_hash: lead.ipHash,
      user_agent: lead.userAgent,
    }),
  });
  const [row] = (await res.json()) as { id: string }[];
  if (!row) throw new UpstreamError("supabase", "Insert into leads returned no row");
  return row.id;
}

export async function markLeadNotified(id: string) {
  await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ notified_at: new Date().toISOString() }),
  });
}
