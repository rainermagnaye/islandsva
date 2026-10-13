import { ROLE_LABELS } from "@/lib/auth/roles";
import { STATUS_LABELS, type UserSummary } from "../contract";

const joined = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function UsersTable({ users }: { users: readonly UserSummary[] }) {
  if (users.length === 0) return <p className="m-0 text-ink-muted">No accounts yet. Invite your first team member above.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-card">
      <table className="w-full border-collapse text-left type-body-sm">
        <caption className="sr-only">Team members and clients</caption>
        <thead className="bg-surface-sunken type-label text-ink">
          <tr>
            <th scope="col" className="px-4 py-3">Name</th>
            <th scope="col" className="px-4 py-3">Roles</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-border">
              <td className="px-4 py-3">
                <span className="block type-label text-ink">{user.fullName || "—"}</span>
                <span className="text-ink-muted">{user.email}</span>
              </td>
              <td className="px-4 py-3 text-ink">{user.roles.map((role) => ROLE_LABELS[role]).join(", ") || "—"}</td>
              <td className="px-4 py-3">
                <span className={user.status === "active" ? "text-status-success" : "text-ink-muted"}>{STATUS_LABELS[user.status]}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{joined.format(new Date(user.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
