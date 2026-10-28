"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Keeps one header panel open at a time (messages, notifications, profile), on every portal: opening one closes
 * the others, and a click outside or Escape closes them all.
 */
export function AccountMenuFrame({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = root.current;
    if (!parent) return;
    const menus = () => parent.querySelectorAll("details");
    const closeAll = (except?: Element) => {
      for (const menu of menus()) if (menu !== except) menu.open = false;
    };
    // `toggle` doesn't bubble, so a handler on this wrapper never heard it. Its capture phase still passes
    // through here on the way to the <details>, so listen there.
    function onToggle(event: Event) {
      const current = event.target;
      if (current instanceof HTMLDetailsElement && current.open) closeAll(current);
    }
    function closeOnOutside(event: PointerEvent) {
      if (event.target instanceof Node && parent?.contains(event.target)) return;
      closeAll();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const open = [...menus()].find((menu) => menu.open);
      if (!open) return;
      closeAll();
      // Back to the button that opened it, so keyboard users don't lose their place.
      open.querySelector("summary")?.focus();
    }
    parent.addEventListener("toggle", onToggle, true);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      parent.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={root} className="flex items-center gap-2">
      {children}
    </div>
  );
}

/** The portrait, or the initials when the file is missing. */
export function AccountPhoto({ photoSrc, fallback, large = false }: { photoSrc?: string; fallback: ReactNode; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (photoSrc && !failed) {
    // A small portrait served by our own route. next/image would add client JS for one picture.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoSrc} alt="" onError={() => setFailed(true)} className={large ? "size-16 object-cover" : "size-12 object-cover"} />;
  }
  return fallback;
}
