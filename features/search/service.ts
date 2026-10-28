import "server-only";
import { adminClientHref, adminLeadHref, adminUserHref, appRoutes, clientTaskHref, clientVaHref, closerClientHref, vaTaskHref } from "@/content/routes";
import { findClients, findOwnVas } from "@/features/clients/service";
import { findLeads } from "@/features/leads/service";
import { findTasks } from "@/features/tasks/service";
import { findEmployee } from "@/features/users/service";
import { SEARCH_GROUP_LIMIT, type SearchGroup, type SearchHit, type SearchResults } from "./contract";
import type { SearchScope } from "./scope";

function hit(id: string, title: string, detail: string, href: string): SearchHit {
  return { id, title, detail, href };
}

const group = (key: string, label: string, hits: SearchHit[]): SearchGroup => ({ key, label, hits });

/**
 * Matches for the caller's scope. Every read runs as the signed-in user, so RLS limits each list again: a Closer
 * sees only the clients they created, a VA only their assigned clients and tasks, a client only their own
 * company's tasks and VAs. The caller has already resolved the scope from the session.
 */
export async function searchRecords(scope: SearchScope, userId: string, term: string): Promise<SearchResults> {
  const limit = SEARCH_GROUP_LIMIT;

  if (scope === "admin") {
    const [leads, clients, employees] = await Promise.all([findLeads(term, limit), findClients(term, limit), findEmployee(term, limit)]);
    return {
      groups: [
        group("leads", "Leads", leads.map((lead) => hit(lead.id, lead.fullName, lead.companyName ? `${lead.companyName} · ${lead.email}` : lead.email, adminLeadHref(lead.id)))),
        group("clients", "Clients", clients.map((client) => hit(client.id, client.companyName, `${client.contactName} · ${client.contactEmail}`, adminClientHref(client.id)))),
        group("employees", "Team", employees.map((person) => hit(person.id, person.fullName, person.email, adminUserHref(person.id)))),
      ],
    };
  }

  if (scope === "closer") {
    const clients = await findClients(term, limit);
    return { groups: [group("clients", "Your clients", clients.map((client) => hit(client.id, client.companyName, client.contactName, closerClientHref(client.id))))] };
  }

  if (scope === "va") {
    const [tasks, clients] = await Promise.all([findTasks(term, limit), findClients(term, limit)]);
    return {
      groups: [
        group("tasks", "Tasks", tasks.map((task) => hit(task.id, task.title, task.companyName, vaTaskHref(task.id)))),
        // VAs have one clients page, not one per client.
        group("clients", "Clients", clients.map((client) => hit(client.id, client.companyName, client.contactName, appRoutes.vaClients))),
      ],
    };
  }

  const [tasks, vas] = await Promise.all([findTasks(term, limit), findOwnVas(userId, term, limit)]);
  return {
    groups: [
      group("tasks", "Tasks", tasks.map((task) => hit(task.id, task.title, `For ${task.vaFirstName}`, clientTaskHref(task.id)))),
      group("vas", "Your VAs", vas.map((va) => hit(va.vaId, va.vaName, "Virtual assistant", clientVaHref(va.vaId)))),
    ],
  };
}
