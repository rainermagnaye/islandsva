"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { appRoutes } from "@/content/routes";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { disableStaffMember, removeStaffMember } from "../actions";
import { type AccessBadge, type RegistrationStep, type StaffDetails, type StaffReviewStatus, type UserSummary } from "../contract";
import type { StaffProfileMeta } from "../profile-fields";
import { StaffReviewActions } from "./staff-review-actions";
import { StaffProfileForm } from "./staff-profile-form";
import { RegistrationStepper, StaffProfileView } from "./staff-profile-view";

/**
 * The profile opens read-only. Confirm and return sit on the right; edit, disable and delete are in the menu beside them.
 * Delete stays available only when the account has no client or assignment history.
 */
export function StaffProfileScreen({
  user,
  actorId,
  details,
  steps,
  meta,
  hasHistory,
  access,
  review,
  returnNote,
}: {
  user: UserSummary;
  actorId: string;
  details: StaffDetails;
  steps: RegistrationStep[];
  meta: StaffProfileMeta;
  hasHistory: boolean;
  access: AccessBadge;
  /** Set for a VA. Null for a Closer or an admin, who are not on this gate. */
  review: StaffReviewStatus | null;
  returnNote: string | null;
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
        <Badge tone={access.tone} size="sm" dot={access.tone === "neutral"}>
          {access.label}
        </Badge>
        {review === "pending_review" && !editing ? (
          <StaffReviewActions
            userId={user.id}
            name={name}
            menu={
              <ProfileMenu
                userId={user.id}
                name={name}
                inactive={user.status === "inactive"}
                ownAccount={ownAccount}
                hasHistory={hasHistory}
                editing={editing}
                onEdit={() => setEditing(true)}
              />
            }
          />
        ) : (
          <div className="ml-auto flex">
            <ProfileMenu
              userId={user.id}
              name={name}
              inactive={user.status === "inactive"}
              ownAccount={ownAccount}
              hasHistory={hasHistory}
              editing={editing}
              onEdit={() => (editing ? stopEditing(false) : setEditing(true))}
            />
          </div>
        )}
      </Card>
      {!access.validated && <RegistrationStepper steps={steps} />}
      {returnNote && review === "pending" && (
        <Alert tone="warning" title="Sent back for a change">
          {returnNote}
        </Alert>
      )}
      {editing ? (
        <StaffProfileForm
          userId={user.id}
          email={user.email}
          details={details}
          meta={meta}
          profilePic={profilePic}
          onSaved={() => stopEditing(true)}
          onCancel={() => stopEditing(false)}
        />
      ) : (
        <StaffProfileView userId={user.id} details={details} email={user.email} meta={meta} />
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
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const disableReason = ownAccount ? "You can't disable your own account." : inactive ? "This profile is already disabled." : undefined;
  const deleteReason = ownAccount ? "You can't delete your own account." : hasHistory ? "This profile has history, so it can only be disabled." : undefined;

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  return (
    <>
      <details ref={menuRef} className="relative">
        <summary
          aria-label="Profile actions"
          className={buttonClasses({
            variant: "ghost",
            className: "size-11 cursor-pointer list-none px-0 marker:content-none [&::-webkit-details-marker]:hidden",
          })}
        >
          <Icon name="menu" />
        </summary>
        <ul className={cx(cardSurface, "absolute right-0 z-10 m-0 mt-2 grid min-w-48 list-none gap-1 p-2 elevation-md")}>
          <li>
            <MenuItem icon="edit" label={editing ? "Close editor" : "Edit profile"} onClick={() => { closeMenu(); onEdit(); }} />
          </li>
          <li>
            <MenuItem
              icon="x-circle"
              label="Disable profile"
              disabled={disableReason !== undefined}
              title={disableReason}
              onClick={() => {
                closeMenu();
                setDisableOpen(true);
              }}
            />
          </li>
          <li>
            <MenuItem
              icon="trash"
              label="Delete profile"
              disabled={deleteReason !== undefined}
              title={deleteReason}
              onClick={() => {
                closeMenu();
                setDeleteOpen(true);
              }}
            />
          </li>
        </ul>
      </details>
      <DisableProfile userId={userId} name={name} open={disableOpen} onClose={() => setDisableOpen(false)} />
      <DeleteProfile userId={userId} name={name} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}

function MenuItem({ icon, label, disabled, title, onClick }: { icon: IconName; label: string; disabled?: boolean; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left type-menu text-ink hover:bg-action-ghost-hover disabled:cursor-not-allowed disabled:text-disabled-ink"
    >
      <Icon name={icon} size={18} />
      {label}
    </button>
  );
}

function DisableProfile({ userId, name, open, onClose }: { userId: string; name: string; open: boolean; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      // The action re-renders the page itself (refresh()), so the badge shows "Deactivated" on success.
      const result = await disableStaffMember(userId);
      if (result.ok) onClose();
      else setError(result.message);
    } catch {
      // A dropped connection must not leave the button stuck on "Disabling".
      setError("We couldn't disable that account. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Disable this profile?"
      description={`${name} keeps their history and loses portal access.`}
      role="alertdialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
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
  );
}

function DeleteProfile({ userId, name, open, onClose }: { userId: string; name: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
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
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Delete this profile?"
      description={`${name} is removed, along with their sign-in. This can't be undone.`}
      role="alertdialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
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
  );
}
