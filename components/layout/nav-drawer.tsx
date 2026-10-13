"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

const DRAWER_ID = "nav-drawer";

/**
 * Mobile menu on the native Popover API: Esc, outside click and top-layer stacking come free.
 * JS only closes it on navigation and swaps the button label.
 */
export function NavDrawer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.hidePopover();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        popoverTarget={DRAWER_ID}
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-grid size-11 cursor-pointer place-items-center rounded-md text-ink hover:bg-action-ghost-hover @min-[1024px]:hidden"
      >
        <Icon name={open ? "x" : "menu"} />
      </button>
      <div
        ref={ref}
        id={DRAWER_ID}
        popover="auto"
        onToggle={(e) => setOpen(e.newState === "open")}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) ref.current?.hidePopover();
        }}
        className="inset-x-0 top-16 bottom-auto m-0 w-full max-w-none border-0 border-b border-border bg-surface-card px-4 pt-3 pb-5 text-ink elevation-lg md:top-[72px]"
      >
        {children}
      </div>
    </>
  );
}
