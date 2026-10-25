import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VA_TIME_ZONE, demoState, manilaDate, type VaSlot } from "../contract";
import { DemoStatusBadge } from "./demo-status-badge";
import { DeleteSlotButton } from "./delete-slot-button";

const dayHeading = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: VA_TIME_ZONE });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: VA_TIME_ZONE });

/** The VA's upcoming slots by Manila day: open ones can be removed, booked ones show the client and the state. */
export function VaSlotList({ slots }: { slots: readonly VaSlot[] }) {
  if (slots.length === 0) {
    return <EmptyState compact title="No slots yet" description="Add the times you can take a demo call. Clients without a VA book them." />;
  }
  const days = Map.groupBy(slots, (slot) => manilaDate(slot.startsAt));

  return (
    <div className="grid gap-5">
      {[...days].map(([day, daySlots]) => (
        <section key={day} aria-labelledby={`day-${day}`} className="grid gap-2">
          <h3 id={`day-${day}`} className="m-0 type-label text-ink">
            {dayHeading.format(new Date(daySlots[0].startsAt))}
          </h3>
          <ul className="m-0 grid list-none gap-1 p-0">
            {daySlots.map((slot) => {
              const label = time.format(new Date(slot.startsAt));
              const state = slot.booking && demoState({ status: slot.booking.status, startsAt: slot.startsAt, endsAt: new Date(Date.parse(slot.startsAt) + 30 * 60 * 1000).toISOString() });
              return (
                <li key={slot.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-1.5 type-body-sm">
                  <span className="w-20 type-label tabular-nums">{label}</span>
                  {slot.booking && state ? (
                    <>
                      <DemoStatusBadge state={state} />
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{slot.booking.companyName}</span>
                    </>
                  ) : (
                    <>
                      <Badge tone="info" size="sm">
                        Open
                      </Badge>
                      <span className="flex-1" />
                      <DeleteSlotButton slotId={slot.id} label={`${dayHeading.format(new Date(slot.startsAt))} ${label}`} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
