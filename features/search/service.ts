import "server-only";
import { adminClientHref, adminLeadHref, adminUserHref } from "@/content/routes";
import { findClients } from "@/features/clients/service";
import { findLeads } from "@/features/leads/service";
import { findEmployee } from "@/features/users/service";
import { SEARCH_GROUP_LIMIT, type SearchHit, type SearchResults } from "./contract";

function hit(id: string, title: string, detail: string, href: string): SearchHit {
  return { id, title, detail, href };
}

/** Leads, clients, and employees that match this term. The caller has already checked the admin session. */
export async function searchRecords(term: string): Promise<SearchResults> {
  const [leads, clients, employees] = await Promise.all([
    findLeads(term, SEARCH_GROUP_LIMIT),
    findClients(term, SEARCH_GROUP_LIMIT),
    findEmployee(term, SEARCH_GROUP_LIMIT),
  ]);

  return {
    leads: leads.map((lead) => hit(lead.id, lead.fullName, lead.companyName ? `${lead.companyName} · ${lead.email}` : lead.email, adminLeadHref(lead.id))),
    clients: clients.map((client) => hit(client.id, client.companyName, `${client.contactName} · ${client.contactEmail}`, adminClientHref(client.id))),
    employees: employees.map((person) => hit(person.id, person.fullName, person.email, adminUserHref(person.id))),
  };
}
