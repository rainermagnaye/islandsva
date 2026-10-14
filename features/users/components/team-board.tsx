"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { cx } from "@/lib/cx";
import { STATUS_LABELS, type AccountStatus, type UserSummary } from "../contract";
import { InviteStaffForm } from "./invite-staff-form";
import { UsersTable } from "./users-table";

const STATUSES = Object.keys(STATUS_LABELS) as AccountStatus[];

/**
 * The team list in the sample layout: the title, a centered search, and Filter plus Create new on the
 * right. Create new opens the invite form. Search and status run on the list already loaded for this admin.
 */
export function TeamBoard({ users }: { users: readonly UserSummary[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AccountStatus | undefined>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const filterRef = useRef<HTMLDetailsElement>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => {
      if (status && user.status !== status) return false;
      if (!term) return true;
      const roles = user.roles.map((role) => ROLE_LABELS[role]).join(" ");
      return `${user.fullName} ${user.email} ${roles}`.toLowerCase().includes(term);
    });
  }, [users, query, status]);

  function chooseStatus(next: AccountStatus | undefined) {
    setStatus(next);
    if (filterRef.current) filterRef.current.open = false;
  }

  function openInvite() {
    setFormKey((key) => key + 1);
    setInviteOpen(true);
  }

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <h1 className="m-0 type-h1">Teams</h1>
        <label className="flex h-11 w-full items-center gap-2 justify-self-center rounded-md border-[1.5px] border-border-strong bg-surface-card px-3.5 lg:w-[280px]">
          <span className="sr-only">Search teams</span>
          <Icon name="search" className="text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams"
            autoComplete="off"
            className="w-full border-0 bg-transparent type-body text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        <div className="flex flex-wrap gap-3 lg:justify-self-end">
          <details ref={filterRef} className="relative">
            <summary className="forced-border inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border-[1.5px] border-border-strong bg-transparent px-5 font-sans text-[0.9375rem] leading-5 font-semibold text-ink marker:content-none hover:border-action-secondary hover:bg-action-ghost-hover [&::-webkit-details-marker]:hidden">
              <Icon name="filter" />
              Filter
            </summary>
            <ul className="absolute left-0 z-10 m-0 mt-2 grid min-w-44 list-none gap-1 rounded-lg border border-border bg-surface-card p-2 elevation-md lg:right-0 lg:left-auto">
              <li>
                <FilterOption pressed={status === undefined} onClick={() => chooseStatus(undefined)}>
                  All
                </FilterOption>
              </li>
              {STATUSES.map((value) => (
                <li key={value}>
                  <FilterOption pressed={status === value} onClick={() => chooseStatus(value)}>
                    {STATUS_LABELS[value]}
                  </FilterOption>
                </li>
              ))}
            </ul>
          </details>
          <Button iconLeft="plus" onClick={openInvite}>
            Create new
          </Button>
        </div>
      </div>

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
        {inviteOpen ? <InviteStaffForm key={formKey} /> : null}
      </Modal>
    </Container>
  );
}

function FilterOption({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cx(
        "flex min-h-9 w-full cursor-pointer items-center rounded-md px-3 text-left type-label",
        pressed ? "bg-surface-sunken text-action-secondary" : "text-ink hover:bg-action-ghost-hover",
      )}
    >
      {children}
    </button>
  );
}
