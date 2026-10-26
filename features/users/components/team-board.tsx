"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Modal } from "@/components/ui/modal";
import { SearchField } from "@/components/ui/search-field";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { STATUS_LABELS, type AccountStatus, type UserSummary } from "../contract";
import { InviteEmployeeForm } from "./invite-employee-form";
import { UsersTable } from "./users-table";

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as AccountStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }));

/**
 * The team list: the title on the left, then search beside Filter and Create new. Create new opens the
 * invite form. Search and status run on the list already loaded for this admin.
 */
export function TeamBoard({ users, total, initialQuery = "" }: { users: readonly UserSummary[]; total: number; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<AccountStatus | undefined>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => {
      if (status) {
        if (user.status !== status) return false;
      } else if (user.status === "inactive") {
        return false;
      }
      if (!term) return true;
      const roles = user.roles.map((role) => ROLE_LABELS[role]).join(" ");
      return `${user.fullName} ${user.email} ${user.phone ?? ""} ${roles}`.toLowerCase().includes(term);
    });
  }, [users, query, status]);

  function openInvite() {
    setFormKey((key) => key + 1);
    setInviteOpen(true);
  }

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 type-h1">Teams</h1>
        <div className="flex flex-wrap items-center gap-3">
          <SearchField label="Search teams" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full sm:w-70" />
          <FilterMenu options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <Button iconLeft="plus" onClick={openInvite}>
            Create new
          </Button>
        </div>
      </div>

      {total > users.length && (
        <Alert tone="info" title={`Showing the newest ${users.length} of ${total} accounts.`}>
          Search and the status filter cover these only.
        </Alert>
      )}

      {users.length === 0 ? (
        <UsersTable users={users} />
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          title="No teams match"
          description="Try another name, or show everyone."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus(undefined);
              }}
            >
              Show everyone
            </Button>
          }
        />
      ) : (
        <UsersTable users={filtered} />
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a team member"
        description="They'll get an email to choose a password. Admins also set up two-factor sign-in."
      >
        {inviteOpen ? <InviteEmployeeForm key={formKey} /> : null}
      </Modal>
    </Container>
  );
}
