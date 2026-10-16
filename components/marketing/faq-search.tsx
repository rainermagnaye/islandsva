"use client";

import { useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { cx } from "@/lib/cx";
import { FaqList, FaqStructuredData } from "./faq-list";

type Faq = { question: string; answer: string };

/** Filter for one page's questions. The accordion itself stays native <details>. */
export function FaqSearch({
  items,
  align = "center",
}: {
  items: readonly Faq[];
  align?: "center" | "start";
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(needle))
    : items;

  return (
    <div className={cx("grid w-full gap-4", align === "center" && "mx-auto max-w-[820px]")}>
      <SearchField label="Search questions" value={query} onChange={(event) => setQuery(event.target.value)} />
      {shown.length > 0 ? (
        <FaqList items={shown} align="start" schemaItems={items} />
      ) : (
        <>
          <p className="m-0 text-ink-muted">No questions match that search.</p>
          <FaqStructuredData items={items} />
        </>
      )}
    </div>
  );
}
