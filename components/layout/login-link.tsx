import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { appRoutes } from "@/content/routes";

/** Person icon in the nav that leads to the client login. Icon-only, so the link carries the accessible name. */
export function LoginLink() {
  return (
    <Link
      href={appRoutes.login}
      aria-label="Client login"
      title="Client login"
      className="inline-grid size-11 place-items-center rounded-md text-ink hover:bg-action-ghost-hover"
    >
      <Icon name="user" />
    </Link>
  );
}
