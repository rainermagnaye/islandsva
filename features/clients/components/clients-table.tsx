import { CLIENT_STATUS_LABELS, type ClientStatus, type ClientSummary } from "../contract";

const created = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const STATUS_TONE: Record<ClientStatus, string> = {
  pending: "text-action-secondary",
  active: "text-status-success",
  inactive: "text-ink-muted",
};

/** Admin client list. Read-only until onboarding (M3) adds activation and invites. */
export function ClientsTable({ clients, empty }: { clients: readonly ClientSummary[]; empty: string }) {
  if (clients.length === 0) return <p className="m-0 text-ink-muted">{empty}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-card">
      <table className="w-full border-collapse text-left type-body-sm">
        <caption className="sr-only">Clients</caption>
        <thead className="bg-surface-sunken type-label text-ink">
          <tr>
            <th scope="col" className="px-4 py-3">Company</th>
            <th scope="col" className="px-4 py-3">Contact</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Created by</th>
            <th scope="col" className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id} className="border-t border-border">
              <td className="px-4 py-3 type-label text-ink">{client.companyName}</td>
              <td className="px-4 py-3">
                <span className="block text-ink">{client.contactName}</span>
                <span className="text-ink-muted">{client.contactEmail}</span>
              </td>
              <td className="px-4 py-3">
                <span className={STATUS_TONE[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</span>
              </td>
              <td className="px-4 py-3 text-ink">{client.createdBy}</td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{created.format(new Date(client.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
