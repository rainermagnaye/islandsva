"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";

/** Search assistants and add each one this task is for. The chosen names stay as a list. */
export function VaAssignField({ vas, error }: { vas: readonly { id: string; firstName: string }[]; error?: string }) {
  const errorId = useId();
  const listId = useId();
  const root = useRef<HTMLFieldSetElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // With one assistant there is nothing to choose: they start selected, and can still be removed.
  const [selected, setSelected] = useState<readonly string[]>(vas.length === 1 ? [vas[0].id] : []);
  const needle = query.trim().toLowerCase();
  const matches = needle ? vas.filter((va) => va.firstName.toLowerCase().includes(needle)) : [];
  const available = matches.filter((va) => !selected.includes(va.id));
  const chosen = vas.filter((va) => selected.includes(va.id));

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function add(id: string) {
    setSelected((current) => (current.includes(id) ? current : [...current, id]));
    setQuery("");
    setOpen(false);
  }

  if (vas.length === 0) {
    return <p className="m-0 type-body-sm text-ink-muted">An assistant needs to be working with you before a task can be assigned.</p>;
  }

  return (
    <fieldset ref={root} className="grid gap-2 border-0 p-0" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}>
      {/* A legend sits outside the fieldset's grid, so the gap skips it: mb-2 matches a field label's gap-2. */}
      <legend className="mb-2 p-0 type-label text-ink">
        Assign VA
        <span aria-hidden="true" className="ml-0.5 text-status-danger">
          *
        </span>
      </legend>
      <div className="relative">
        <SearchField
          label="Search assistants"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && needle.length > 0}
          aria-controls={listId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (available[0]) add(available[0].id);
          }}
        />
        {open && needle.length > 0 && (
          <ul id={listId} role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface-card elevation-md">
            {available.length === 0 ? (
              <li className="flex min-h-11 items-center px-3 type-body-sm text-ink-muted">{matches.length === 0 ? "No assistant matches that search." : "Already added."}</li>
            ) : (
              available.map((va) => (
                <li key={va.id}>
                  <button type="button" role="option" aria-selected={false} className="flex min-h-11 w-full items-center px-3 text-left type-body hover:bg-surface-sunken" onClick={() => add(va.id)}>
                    {va.firstName}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {chosen.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0" aria-label="Selected assistants">
          {chosen.map((va) => (
            <li key={va.id} className="flex min-h-11 items-center gap-2 rounded-md px-1">
              <input type="hidden" name="vaId" value={va.id} />
              <span className="min-w-0 flex-1 truncate type-body">{va.firstName}</span>
              <button
                type="button"
                aria-label={`Remove ${va.firstName}`}
                className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                onClick={() => setSelected((current) => current.filter((id) => id !== va.id))}
              >
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="m-0 flex items-center gap-1 type-label text-status-danger">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </fieldset>
  );
}
