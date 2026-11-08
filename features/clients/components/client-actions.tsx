"use client";

import { lazy, Suspense, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { cardSurface } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { adminClientHref } from "@/content/routes";
import { cx } from "@/lib/cx";
import { setClientPaused } from "../actions";
import type { ClientPackageValues } from "../contract";

// Loaded when the menu item is chosen, so the profile doesn't ship the package form up front.
const ClientPackageDialog = lazy(() => import("./client-package-dialog").then((m) => ({ default: m.ClientPackageDialog })));

/**
 * The profile menu. It stays in the header on every tab. `currentPackage` is passed only while the client is pending
 * (the package can't change once they're active): with no package a Set package button sits before the menu,
 * otherwise the menu has Change package.
 */
export function ClientActions({
  clientId,
  editing,
  disabledAt,
  currentPackage,
}: {
  clientId: string;
  editing: boolean;
  disabledAt: string | null;
  currentPackage?: ClientPackageValues;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [changingPackage, setChangingPackage] = useState(false);
  const disabling = !disabledAt;

  const needsPackage = currentPackage !== undefined && !currentPackage.packageCode;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
      {needsPackage && (
        <Button type="button" size="sm" onClick={() => setChangingPackage(true)}>
          Set package
        </Button>
      )}
      <details ref={menu} className="relative">
        <summary aria-label="Client actions" className={buttonClasses({ variant: "ghost", className: "size-11 cursor-pointer list-none px-0 marker:content-none [&::-webkit-details-marker]:hidden" })}>
          <Icon name="menu" />
        </summary>
        <ul className={cx(cardSurface, "absolute right-0 z-20 m-0 mt-2 grid w-48 list-none gap-1 p-2 elevation-md")}>
          <MenuItem
            icon="edit"
            label={editing ? "Close editor" : "Edit profile"}
            onClick={() => {
              const details = menu.current;
              if (details) details.open = false;
              router.push(editing ? adminClientHref(clientId) : `${adminClientHref(clientId)}?edit=1`);
            }}
          />
          {currentPackage?.packageCode && (
            <MenuItem
              icon="briefcase"
              label="Change package"
              onClick={() => {
                const details = menu.current;
                if (details) details.open = false;
                setChangingPackage(true);
              }}
            />
          )}
          <MenuItem
            icon={disabledAt ? "check" : "x-circle"}
            label={disabledAt ? "Enable" : "Disable"}
            onClick={() => {
              const details = menu.current;
              if (details) details.open = false;
              setConfirming(true);
            }}
          />
        </ul>
      </details>
      </div>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={disabling ? "Disable client" : "Enable client"}
          description={disabling ? "This client leaves the client list until you enable them. The record stays." : "This client shows on the client list again."}
        >
          <Form aria-label={disabling ? "Disable client" : "Enable client"} onSubmit={async (formData) => {
            const result = await setClientPaused(formData);
            if (result.ok) setConfirming(false);
            return result;
          }}>
            {({ pending }) => (
              <>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="disabled" value={disabling ? "true" : "false"} />
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending}>
                    {pending ? "Saving" : disabling ? "Disable" : "Enable"}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </Modal>
      )}
      {changingPackage && currentPackage && (
        <Suspense fallback={null}>
          <ClientPackageDialog clientId={clientId} current={currentPackage} onClose={() => setChangingPackage(false)} />
        </Suspense>
      )}
    </>
  );
}

function MenuItem({ icon, label, onClick }: { icon: "edit" | "check" | "x-circle" | "briefcase"; label: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left type-menu text-ink hover:bg-action-ghost-hover">
        <Icon name={icon} size={18} />
        {label}
      </button>
    </li>
  );
}
