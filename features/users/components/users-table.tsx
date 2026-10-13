import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { STATUS_LABELS, type AccountStatus, type UserSummary } from "../contract";

const joined = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

// Invited = waiting on them to accept, active = signed in, deactivated = no action needed.
const TONES: Record<AccountStatus, BadgeTone> = { invited: "info", active: "success", inactive: "neutral" };

const COLUMNS: Column<UserSummary>[] = [
  // Invited accounts may have no name yet: the email then stands in as the title instead of a dash.
  { key: "name", label: "Name", render: (user) => <CellTitle title={user.fullName || user.email} subtitle={user.fullName ? user.email : undefined} /> },
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
  { key: "joined", label: "Joined", render: (user) => <span className="whitespace-nowrap text-ink-muted">{joined.format(new Date(user.createdAt))}</span> },
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
