"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { appRoutes } from "@/content/routes";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { disableEmployee, removeEmployee } from "../actions";

// The employee profile's actions menu and its disable and delete confirmations (Server Actions
// disableEmployee / removeEmployee check the admin role).

export function ProfileMenu({
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
      const result = await disableEmployee(userId);
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
      const result = await removeEmployee(userId);
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
