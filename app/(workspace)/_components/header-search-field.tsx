"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// The class alone. Importing it from card.tsx pulls Card into this chunk and pushes /profile over the first-load budget.
import { cardSurface } from "@/components/ui/card-surface";
import { SearchField } from "@/components/ui/search-field";
import { SEARCH_MIN_LENGTH, type SearchHit, type SearchResults } from "@/features/search/contract";

const GROUPS = [
  ["leads", "Leads"],
  ["clients", "Clients"],
  ["employees", "Team"],
] as const;

/** Header search. The list stays closed until three letters, then shows leads, clients, and employees. */
export function HeaderSearchField() {
  const router = useRouter();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | null>(null);
  const term = value.trim();
  const ready = term.length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    return () => {
      request.current?.abort();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function onChange(next: string) {
    setValue(next);
    const trimmed = next.trim();
    setOpen(trimmed.length >= SEARCH_MIN_LENGTH);
    request.current?.abort();
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setResults(null);
      setStatus("idle");
      return;
    }
    setResults(null);
    setStatus("loading");
    const controller = new AbortController();
    request.current = controller;
    timer.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        const body = (await response.json()) as { data?: SearchResults };
        if (!body.data) throw new Error("search failed");
        setResults(body.data);
        setStatus("idle");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults(null);
        setStatus("error");
      }
    }, 250);
  }

  function clear() {
    request.current?.abort();
    if (timer.current !== null) window.clearTimeout(timer.current);
    setValue("");
    setResults(null);
    setStatus("idle");
    setOpen(false);
  }

  function openFirst() {
    const first = results ? GROUPS.flatMap(([key]) => results[key])[0] : undefined;
    if (!first) return;
    clear();
    router.push(first.href);
  }

  const show = open && ready;
  const hits = results ? GROUPS.flatMap(([key]) => results[key]) : [];

  return (
    <div ref={root} className="relative w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          openFirst();
        }}
      >
        <SearchField
          label="Search"
          value={value}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (ready) setOpen(true);
          }}
        />
      </form>
      {show && (
        <div id={listId} className={`${cardSurface} absolute top-full z-20 mt-2 w-full elevation-md`}>
          {status === "loading" && hits.length === 0 && <p className="m-0 px-3 py-3 type-body text-ink-muted">Searching…</p>}
          {status === "error" && <p className="m-0 px-3 py-3 type-body text-ink-muted">Search is unavailable. Try again.</p>}
          {status !== "error" && results && hits.length === 0 && status !== "loading" && (
            <p className="m-0 px-3 py-3 type-body text-ink-muted">No matches.</p>
          )}
          {hits.length > 0 && (
            <div className="grid gap-2 p-2">
              {GROUPS.map(([key, label]) => (
                <ResultGroup key={key} label={label} hits={results?.[key] ?? []} onPick={clear} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, hits, onPick }: { label: string; hits: readonly SearchHit[]; onPick: () => void }) {
  if (hits.length === 0) return null;
  return (
    <section aria-label={label}>
      <h2 className="m-0 px-3 py-1 type-label text-ink-muted">{label}</h2>
      <ul className="m-0 list-none p-0">
        {hits.map((hit) => (
          <li key={hit.id}>
            <Link href={hit.href} onClick={onPick} className="grid rounded-md px-3 py-2 no-underline hover:bg-action-ghost-hover">
              <span className="type-label text-ink">{hit.title}</span>
              <span className="type-body text-ink-muted">{hit.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
