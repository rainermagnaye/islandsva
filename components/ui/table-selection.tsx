"use client";

import { useRef, type ChangeEvent, type ReactNode } from "react";

/** Select-all for a server-rendered table. The boxes stay native inputs; this only keeps them in step. */
export function TableSelection({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onChange(event: ChangeEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    const root = ref.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLInputElement>("tbody .data-table__check input[type='checkbox']")];
    const all = root.querySelector<HTMLInputElement>("thead .data-table__check input[type='checkbox']");
    if (!all) return;
    if (target === all) {
      for (const box of rows) box.checked = all.checked;
      all.indeterminate = false;
      return;
    }
    const count = rows.filter((box) => box.checked).length;
    all.checked = rows.length > 0 && count === rows.length;
    all.indeterminate = count > 0 && count < rows.length;
  }

  return (
    <div ref={ref} className={className} onChange={onChange}>
      {children}
    </div>
  );
}
