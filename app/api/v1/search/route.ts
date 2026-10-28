import { SEARCH_MIN_LENGTH, type SearchResults } from "@/features/search/contract";
import { searchScopeFor } from "@/features/search/scope";
import { searchRecords } from "@/features/search/service";
import { parseSearchQuery } from "@/features/search/validation";
import { ApiError } from "@/lib/api/errors";
import { createGetHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";

const EMPTY: SearchResults = { groups: [] };

export const GET = createGetHandler({ unavailableMessage: "Search is unavailable. Please try again in a moment." }, async ({ req }) => {
  const user = await getSessionUser();
  const scope = user ? searchScopeFor(user) : null;
  if (!user || !scope) throw new ApiError(404, "not_found", "Not found.");

  const parsed = parseSearchQuery({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.ok) throw new ApiError(400, "invalid_request", parsed.formError);
  if (parsed.term.length < SEARCH_MIN_LENGTH) return ok(EMPTY);

  return ok(await searchRecords(scope, user.id, parsed.term));
});
