"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { STATUS_LABELS, type AccountStatus, type RegistrationStep, type StaffDetails, type UserSummary } from "../contract";
import { disableStaffMember, removeStaffMember } from "../actions";
import { StaffProfileForm } from "./staff-profile-form";
import { RegistrationStepper, StaffProfileView } from "./staff-profile-view";

const ACCOUNT_TONES: Record<AccountStatus, BadgeTone> = { invited: "info", active: "success", inactive: "neutral" };

/**
 * The profile opens read-only. Edit, disable and delete sit in the header, beside the name.
 * A picture is not stored yet, so the header shows initials.
 */
export function StaffProfileScreen({
  user,
  actorId,
  details,
  steps,
  hasHistory,
}: {
  user: UserSummary;
  actorId: string;
  details: StaffDetails;
  steps: RegistrationStep[];
  hasHistory: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const name = details.fullName || user.email;
  const ownAccount = user.id === actorId;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
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
          hasHistory={hasHistory}
          editing={editing}
          onEdit={() => setEditing((open) => !open)}
        />
      </header>
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
  hasHistory,
  editing,
  onEdit,
}: {
  userId: string;
  name: string;
  inactive: boolean;
  ownAccount: boolean;
  hasHistory: boolean;
  editing: boolean;
  onEdit: () => void;
}) {
  const disableReason = ownAccount ? "You can't disable your own account." : inactive ? "This profile is already disabled." : undefined;
  const deleteReason = ownAccount ? "You can't delete your own account." : hasHistory ? "This profile has client history, so it can't be deleted." : undefined;

  return (
    <div className="ml-auto flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" iconLeft="edit" onClick={onEdit}>
        {editing ? "Close editor" : "Edit profile"}
      </Button>
      <DisableProfile userId={userId} name={name} disabled={disableReason !== undefined} reason={disableReason} />
      <DeleteProfile userId={userId} name={name} disabled={deleteReason !== undefined} reason={deleteReason} />
    </div>
  );
}

function DisableProfile({ userId, name, disabled, reason }: { userId: string; name: string; disabled: boolean; reason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    const result = await disableStaffMember(userId);
    if (result.ok) {
      setOpen(false);
      setPending(false);
      router.refresh();
      return;
    }
    setError(result.message);
    setPending(false);
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

function DeleteProfile({ userId, name, disabled, reason }: { userId: string; name: string; disabled: boolean; reason?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    const result = await removeStaffMember(userId, true);
    if (!result.ok) {
      setError(result.message);
      setPending(false);
    }
  }

  return (
    <>
      <span title={reason}>
        <Button variant="ghost" size="sm" iconLeft="trash" onClick={() => setOpen(true)} disabled={disabled}>
          Delete profile
        </Button>
      </span>
      <Modal
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Delete this profile?"
        description={`${name} will lose their sign-in. This can't be undone.`}
        role="alertdialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Keep profile
            </Button>
            <Button variant="danger" onClick={confirm} loading={pending}>
              {pending ? "Deleting" : "Delete profile"}
            </Button>
          </>
        }
      >
        {error && <Alert tone="danger" title={error} />}
      </Modal>
    </>
  );
}
