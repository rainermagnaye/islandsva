"use client";

import { useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import { signOutEverywhere } from "../actions";

const itemClass =
  "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 text-left type-menu text-ink hover:bg-action-ghost-hover";

/** The profile hamburger: edit this page, or end every signed-in device. */
export function ProfileMenu({ editing, onEdit }: { editing: boolean; onEdit: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);

  function close() {
    if (menu.current) menu.current.open = false;
  }

  return (
    <details ref={menu} className="relative">
      <summary
        aria-label="Profile actions"
        className={buttonClasses({
          variant: "ghost",
          className: "size-11 cursor-pointer list-none px-0 marker:content-none [&::-webkit-details-marker]:hidden",
        })}
      >
        <Icon name="menu" />
      </summary>
      <ul className={cx(cardSurface, "absolute right-0 z-10 m-0 mt-2 grid min-w-56 list-none gap-1 p-2 elevation-md")}>
        {!editing && (
          <li>
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                close();
                onEdit();
              }}
            >
              <Icon name="edit" size={18} />
              Edit
            </button>
          </li>
        )}
        <li>
          <form action={signOutEverywhere}>
            <button type="submit" className={itemClass}>
              <Icon name="log-out" size={18} />
              Sign out of all devices
            </button>
          </form>
        </li>
      </ul>
    </details>
  );
}
