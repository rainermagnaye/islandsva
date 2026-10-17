"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { appRoutes } from "@/content/routes";
import { STATUS_LABELS, type AccountStatus, type RegistrationStep, type StaffDetails, type UserSummary } from "../contract";
import type { StaffProfileMeta } from "../profile-fields";
import { disableStaffMember, removeStaffMember } from "../actions";
import { StaffProfileForm } from "./staff-profile-form";
import { RegistrationStepper, StaffProfileView } from "./staff-profile-view";

const ACCOUNT_TONES: Record<AccountStatus, BadgeTone> = { invited: "info", active: "success", inactive: "neutral" };

/**
 * The profile opens read-only. Edit, disable and delete sit in the header, beside the name.
 * Delete stays available only when the account has no client or assignment history.
 */
export function StaffProfileScreen({
  user,
  actorId,
  details,
  resumeType,
  steps,
  meta,
  hasHistory,
}: {
  user: UserSummary;
  actorId: string;
  details: StaffDetails;
  resumeType: string | null;
  steps: RegistrationStep[];
  meta: StaffProfileMeta;
  hasHistory: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pictureVersion, setPictureVersion] = useState(0);
  const name = details.fullName || user.email;
  const ownAccount = user.id === actorId;

  function choosePhoto(file: File | undefined) {
    const next = file && file.size > 0 ? file : null;
    setProfilePic(next);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  function stopEditing(saved: boolean) {
    setEditing(false);
    setProfilePic(null);
    if (saved) {
      setPictureVersion(Date.now());
      return;
    }
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <div className="relative size-12 shrink-0">
          <Avatar key={preview ?? `${user.id}-${pictureVersion}`} name={name} src={preview ?? `/admin/users/${user.id}/avatar?v=${pictureVersion}`} />
          {editing && (
            <label className="absolute inset-0 grid cursor-pointer place-items-end overflow-hidden rounded-lg" title="Change picture">
              <span className="w-full bg-ink/80 text-center type-caption text-surface-card">Edit</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} className="sr-only" />
            </label>
          )}
        </div>
        <h1 className="m-0 min-w-0 truncate type-h3">{name}</h1>
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
          onEdit={() => (editing ? stopEditing(false) : setEditing(true))}
        />
      </Card>
      <RegistrationStepper steps={steps} />
      {editing ? (
        <StaffProfileForm
          userId={user.id}
          email={user.email}
          details={details}
          resumeType={resumeType}
          meta={meta}
          profilePic={profilePic}
          onSaved={() => stopEditing(true)}
          onCancel={() => stopEditing(false)}
        />
      ) : (
        <StaffProfileView userId={user.id} details={details} resumeType={resumeType} email={user.email} meta={meta} />
      )}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // A small portrait served by our own route. next/image would add client JS for one 48px picture.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-12 shrink-0 rounded-lg object-cover" onError={() => setFailed(true)} />
    );
  }
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
  const deleteReason = ownAccount ? "You can't delete your own account." : hasHistory ? "This profile has history, so it can only be disabled." : undefined;

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

function DeleteProfile({ userId, name, disabled, reason }: { userId: string; name: string; disabled: boolean; reason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      const result = await removeStaffMember(userId);
      if (result.ok) router.push(appRoutes.adminUsers);
      else setError(result.message);
    } catch {
      setError("We couldn't delete that account. Check your connection and try again.");
    } finally {
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
        description={`${name} is removed, along with their sign-in. This can't be undone.`}
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
