"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { STATUS_LABELS, type AccountStatus, type RegistrationStep, type StaffDetails, type UserSummary } from "../contract";
import { disableStaffMember } from "../actions";
import { StaffProfileForm } from "./staff-profile-form";
import { RegistrationStepper, StaffProfileView } from "./staff-profile-view";

const ACCOUNT_TONES: Record<AccountStatus, BadgeTone> = { invited: "info", active: "success", inactive: "neutral" };

/**
 * The profile opens read-only. Edit and disable sit in the header, beside the name. Accounts are
 * deactivated, never deleted, so their history stays resolvable (CLAUDE.md §7).
 * A picture is not stored yet, so the header shows initials.
 */
export function StaffProfileScreen({
  user,
  actorId,
  details,
  steps,
}: {
  user: UserSummary;
  actorId: string;
  details: StaffDetails;
  steps: RegistrationStep[];
}) {
  const [editing, setEditing] = useState(false);
  const name = details.fullName || user.email;
  const ownAccount = user.id === actorId;

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0">
          <h1 className="m-0 truncate type-h3">{name}</h1>
          <p className="m-0 truncate type-body-sm text-ink-muted">{user.email}</p>
        </div>
        <Badge tone={ACCOUNT_TONES[user.status]} size="sm" dot={user.status === "inactive"}>
          {STATUS_LABELS[user.status]}
        </Badge>
        <ProfileMenu
          userId={user.id}
          name={name}
          inactive={user.status === "inactive"}
          ownAccount={ownAccount}
          editing={editing}
          onEdit={() => setEditing((open) => !open)}
        />
      </Card>
      <RegistrationStepper steps={steps} />
      {editing ? (
        <StaffProfileForm userId={user.id} email={user.email} details={details} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <StaffProfileView details={details} email={user.email} />
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface-sunken type-h4 text-ink" aria-hidden="true">
      {initials || <Icon name="user" size={22} />}
    </span>
  );
}

function ProfileMenu({
  userId,
  name,
  inactive,
  ownAccount,
  editing,
  onEdit,
}: {
  userId: string;
  name: string;
  inactive: boolean;
  ownAccount: boolean;
  editing: boolean;
  onEdit: () => void;
}) {
  const disableReason = ownAccount ? "You can't disable your own account." : inactive ? "This profile is already disabled." : undefined;

  return (
    <div className="ml-auto flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" iconLeft="edit" onClick={onEdit}>
        {editing ? "Close editor" : "Edit profile"}
      </Button>
      <DisableProfile userId={userId} name={name} disabled={disableReason !== undefined} reason={disableReason} />
    </div>
  );
}

function DisableProfile({ userId, name, disabled, reason }: { userId: string; name: string; disabled: boolean; reason?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      // The action re-renders the page itself (refresh()), so the badge shows "Deactivated" on success.
      const result = await disableStaffMember(userId);
      if (result.ok) setOpen(false);
      else setError(result.message);
    } catch {
      // A dropped connection must not leave the button stuck on "Disabling".
      setError("We couldn't disable that account. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <span title={reason}>
        <Button variant="ghost" size="sm" iconLeft="x-circle" onClick={() => setOpen(true)} disabled={disabled}>
          Disable profile
        </Button>
      </span>
      <Modal
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Disable this profile?"
        description={`${name} keeps their history and loses portal access.`}
        role="alertdialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Keep active
            </Button>
            <Button onClick={confirm} loading={pending}>
              {pending ? "Disabling" : "Disable profile"}
            </Button>
          </>
        }
      >
        {error && <Alert tone="danger" title={error} />}
      </Modal>
    </>
  );
}
