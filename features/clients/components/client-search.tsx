"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchField } from "@/components/ui/search-field";
import { appRoutes } from "@/content/routes";

/** Writes `?q=` so the client list, status tabs and pages stay shareable. */
export function ClientSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const urlQuery = params.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (pending.current !== null) {
      if (urlQuery === pending.current) pending.current = null;
      return;
    }
    setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const term = value.trim();
    if (term === urlQuery) return;
    const handle = window.setTimeout(() => {
      pending.current = term;
      const next = new URLSearchParams(params.toString());
      if (term) next.set("q", term);
      else next.delete("q");
      next.delete("page");
      const search = next.toString();
      router.replace(search ? `${appRoutes.adminClients}?${search}` : appRoutes.adminClients, { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value, urlQuery, params, router]);

  return <SearchField label="Search clients" value={value} onChange={(event) => setValue(event.target.value)} className="w-full sm:w-70" />;
}
