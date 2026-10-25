"use client";

import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";

/** Closes the other menu, and both menus when the pointer or Escape leaves them. */
export function AccountMenuFrame({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      const parent = root.current;
      if (!parent || (event.target instanceof Node && parent.contains(event.target))) return;
      for (const menu of parent.querySelectorAll("details")) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const parent = root.current;
      if (!parent) return;
      for (const menu of parent.querySelectorAll("details")) menu.open = false;
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function onToggle(event: SyntheticEvent<HTMLDivElement>) {
    const current = event.target;
    if (!(current instanceof HTMLDetailsElement) || !current.open) return;
    const parent = root.current;
    if (!parent) return;
    for (const menu of parent.querySelectorAll("details")) {
      if (menu !== current) menu.open = false;
    }
  }

  return (
    <div ref={root} onToggle={onToggle} className="flex items-center gap-2">
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
