import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { clientVaHref } from "@/content/routes";

/** The client's team as a list on the same surface as the tasks panel. Each row opens that VA. */
export function ClientDashboard({
  vas,
  empty,
  heading = true,
}: {
  vas: readonly { id: string; firstName: string; photoSrc?: string; done: number; pending: number }[];
  empty: ReactNode;
  /** The dashboard names the section. The My assistants page already has that title. */
  heading?: boolean;
}) {
  return (
    <Card as="section" className="grid content-start gap-3" aria-labelledby={heading ? "my-vas" : undefined} aria-label={heading ? undefined : "My assistants"}>
      {heading && (
        <h2 id="my-vas" className="m-0 type-h3">
          My assistants
        </h2>
      )}
      {vas.length === 0 ? (
        empty
      ) : (
        <ul className="m-0 grid list-none gap-1 p-0">
          {vas.map((va) => (
            <li key={va.id}>
              <Link
                href={clientVaHref(va.id)}
                className="flex min-h-11 items-center gap-3 rounded-md px-2 text-ink no-underline hover:bg-surface-sunken"
              >
                <Avatar name={va.firstName} src={va.photoSrc} size="md" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate type-body">{va.firstName}</span>
                  <span className="type-caption text-ink-muted">
                    Tasks: {va.done}/{va.pending}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
