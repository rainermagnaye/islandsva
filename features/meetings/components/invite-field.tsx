"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import type { BookingChoice, BookingGuest } from "../contract";

/** One searchable invite list for clients and staff, the way a calendar guest field works. */
export function InviteField({ clients, staff, guests, error }: {
  clients: readonly BookingChoice[];
  staff: readonly BookingChoice[];
  guests: readonly BookingGuest[];
  error?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<BookingGuest[]>(() => [...guests]);
  const [active, setActive] = useState(0);

  const people = useMemo<BookingGuest[]>(() => [
    ...clients.map((item) => ({ id: item.id, kind: "client" as const, name: item.label })),
    ...staff.map((item) => ({ id: item.id, kind: "staff" as const, name: item.label })),
  ], [clients, staff]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return people
      .filter((person) => person.name.toLowerCase().includes(needle) && !picked.some((item) => item.kind === person.kind && item.id === person.id))
      .slice(0, 8);
  }, [people, picked, query]);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function add(person: BookingGuest) {
    setPicked((current) => (current.some((item) => item.kind === person.kind && item.id === person.id) ? current : [...current, person]));
    setQuery("");
    setActive(0);
    setOpen(false);
  }

  function remove(person: BookingGuest) {
    setPicked((current) => current.filter((item) => !(item.kind === person.kind && item.id === person.id)));
  }

  const shown = open && matches.length > 0;

  return (
    <Field id={id} label="Invite" hint="Search for a client or a team member." error={error} optional>
      <div ref={root} className="relative">
        <div className="forced-border flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border-control border-border-strong bg-surface-card px-2 py-1.5 focus-within:border-focus-ring">
          {picked.map((person) => (
            <span key={`${person.kind}-${person.id}`} className="inline-flex max-w-full items-center gap-1 rounded-pill bg-surface-sunken py-0.5 pr-1 pl-2.5 type-caption text-ink">
              <span className="truncate">{person.name}</span>
              <span className="text-ink-muted">{person.kind === "client" ? "Client" : "Staff"}</span>
              <button type="button" aria-label={`Remove ${person.name}`} onClick={() => remove(person)} className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-pill hover:bg-action-ghost-hover">
                <Icon name="x" size={14} />
              </button>
              <input type="hidden" name={person.kind === "client" ? "clientIds" : "staffIds"} value={person.id} />
            </span>
          ))}
          <input
            id={id}
            role="combobox"
            aria-expanded={shown}
            aria-controls={shown ? listId : undefined}
            aria-autocomplete="list"
            value={query}
            placeholder={picked.length === 0 ? "Search by name" : ""}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (matches[active]) add(matches[active]);
              } else if (event.key === "Escape") {
                setOpen(false);
              } else if (event.key === "Backspace" && query === "" && picked[picked.length - 1]) {
                remove(picked[picked.length - 1]);
              }
            }}
            className="min-h-9 min-w-32 flex-1 border-0 bg-transparent px-1 type-body text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        {shown && (
          <ul id={listId} role="listbox" className="absolute z-30 m-0 mt-1 grid max-h-60 w-full list-none overflow-auto rounded-lg border border-border bg-surface-card p-1 elevation-md">
            {matches.map((person, index) => (
              <li key={`${person.kind}-${person.id}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(person)}
                  className={cx("flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left type-body-sm", index === active ? "bg-action-ghost-hover" : "hover:bg-action-ghost-hover")}
                >
                  <span className="truncate">{person.name}</span>
                  <span className="type-caption text-ink-muted">{person.kind === "client" ? "Client" : "Staff"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
