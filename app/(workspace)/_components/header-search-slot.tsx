import { Suspense } from "react";
import { HeaderSearch } from "./header-search";

/**
 * The header search, rendered by the @search slot of each section an admin uses: admin, closer, dashboard and
 * profile, each with its own slot pages (the section home and a catch-all for its sub-pages). Never one catch-all
 * at the workspace root: route groups aren't URL segments, so it would also match the marketing and sign-in URLs,
 * which strict route matching then rejects as pages that can't render (every one of them 404s under next dev).
 * Search is admin-only, so the client section shows nothing (the empty default); the VA section has its own empty
 * slot, because it is at the first-load budget.
 */
export function HeaderSearchSlot() {
  return (
    <Suspense fallback={null}>
      <HeaderSearch />
    </Suspense>
  );
}
