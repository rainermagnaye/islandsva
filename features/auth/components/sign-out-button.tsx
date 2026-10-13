import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

/** A plain form posting to the signOut action — works before JavaScript loads. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm" iconLeft="log-out">
        Sign out
      </Button>
    </form>
  );
}
