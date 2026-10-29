import { searchScopeFor } from "@/features/search/scope";
import { getSessionUser } from "@/lib/auth/session";
import { HeaderSearchField } from "./header-search-field";

/** Search in the portal header, for every signed-in role. What it finds depends on the role (features/search/service.ts). */
export async function HeaderSearch() {
  const user = await getSessionUser();
  if (!user || !searchScopeFor(user)) return null;
  return <HeaderSearchField />;
}
