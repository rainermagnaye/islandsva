import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import type { AgendaItem } from "@/features/meetings/agenda";

/** Today's meetings and confirmed demo calls, in Manila time. The calendar has the detail and the actions. */
export function TodaySchedule({ items }: { items: readonly AgendaItem[] }) {
  return (
    <Panel
      boxed
      title="Today's schedule"
      action={
        <Link href={appRoutes.vaCalendar} className="type-label">
          Open calendar
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">No calls today.</p>
      ) : (
        <ol className="m-0 grid list-none p-0">
          {items.map((item) => (
            <li key={item.key} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
              <span className="type-label text-ink tabular-nums">{item.when}</span>
              <span className="grid gap-0.5">
                <span className="type-label text-ink">{item.title}</span>
                {(item.who || item.badge) && (
                  <span className="flex flex-wrap items-center gap-2 type-body-sm text-ink-muted">
                    {item.kind === "meeting" && item.who}
                    {item.badge && (
                      <Badge tone={item.badge.tone} size="sm">
                        {item.badge.label}
                      </Badge>
                    )}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
