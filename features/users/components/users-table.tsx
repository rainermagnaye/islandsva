import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { adminUserHref } from "@/content/routes";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { STATUS_LABELS, type AccountStatus, type UserSummary } from "../contract";

// Invited = waiting on them to accept, active = signed in, deactivated = no action needed.
const TONES: Record<AccountStatus, BadgeTone> = { invited: "info", active: "success", inactive: "neutral" };

function clipped(value: string) {
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  );
}

const COLUMNS: Column<UserSummary>[] = [
  {
    key: "name",
    label: "Name",
    render: (user) => (
      <Link href={adminUserHref(user.id)} className="staff-row-link" title={user.fullName || undefined}>
        {user.fullName || "—"}
      </Link>
    ),
  },
  { key: "email", label: "Email Address", render: (user) => clipped(user.email) },
  { key: "phone", label: "Phone Number", render: (user) => (user.phone ? clipped(user.phone) : "—") },
  { key: "roles", label: "Roles", render: (user) => user.roles.map((role) => ROLE_LABELS[role]).join(", ") || "—" },
  {
    key: "status",
    label: "Status",
    render: (user) => (
      <Badge tone={TONES[user.status]} size="sm" dot={TONES[user.status] === "neutral"}>
        {STATUS_LABELS[user.status]}
      </Badge>
    ),
  },
];

export function UsersTable({ users, headingLevel = 2 }: { users: readonly UserSummary[]; headingLevel?: 2 | 3 }) {
  return (
    <DataTable
      caption="Team members and clients"
      columns={COLUMNS}
      rows={users}
      rowKey={(user) => user.id}
      empty={<EmptyState compact headingLevel={headingLevel} title="No accounts yet" description="Invite your first team member and they'll appear here." />}
    />
  );
}
