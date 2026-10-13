import Link from "next/link";
import { adminLeadHref } from "@/content/routes";
import { isConvertible, type LeadSummary } from "../contract";
import { ConvertLeadButton } from "./convert-lead-button";
import { LeadStatusLabel, packageName } from "./lead-status";

const received = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Admin lead list. Only rows that can still be converted get the Convert action. */
export function LeadsTable({
  leads,
  caption = "Contact-form leads",
  empty = "No leads yet. They appear here when someone sends the contact form.",
}: {
  leads: readonly LeadSummary[];
  caption?: string;
  empty?: string;
}) {
  if (leads.length === 0) return <p className="m-0 text-ink-muted">{empty}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-card">
      <table className="w-full border-collapse text-left type-body-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-sunken type-label text-ink">
          <tr>
            <th scope="col" className="px-4 py-3">Name</th>
            <th scope="col" className="px-4 py-3">Company</th>
            <th scope="col" className="px-4 py-3">Package</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Received</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-t border-border">
              <td className="px-4 py-3">
                <Link href={adminLeadHref(lead.id)} className="block type-label text-ink">
                  {lead.fullName}
                </Link>
                <span className="text-ink-muted">{lead.email}</span>
              </td>
              <td className="px-4 py-3 text-ink">{lead.companyName ?? "—"}</td>
              <td className="px-4 py-3 text-ink">{packageName(lead.packageCode)}</td>
              <td className="px-4 py-3">
                <LeadStatusLabel status={lead.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{received.format(new Date(lead.createdAt))}</td>
              <td className="px-4 py-3 text-right">
                {isConvertible(lead.status) && (
                  <ConvertLeadButton lead={{ id: lead.id, fullName: lead.fullName, companyName: lead.companyName }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
