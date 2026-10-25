import { getSessionUser, needsSecondFactor } from "@/lib/auth/session";
import { HeaderSearchField } from "./header-search-field";

/** Search in the portal header. Only an admin who has finished two-factor sign-in can use the lists it opens. */
export async function HeaderSearch() {
  const user = await getSessionUser();
  if (!user?.roles.includes("admin") || needsSecondFactor(user)) return null;
  return <HeaderSearchField />;
}
