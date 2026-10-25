import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { VaDemo } from "../booking-dal";
import { DEMO_STATUS_LABELS, VA_TIME_ZONE, formatInZone } from "../contract";
import { AnswerDemoButtons } from "./answer-demo-buttons";

/** The VA's open demos: requests to confirm or decline, then confirmed calls. Times in Manila and the client's zone. */
export function VaDemoList({ demos }: { demos: readonly VaDemo[] }) {
  if (demos.length === 0) {
    return <EmptyState compact title="No demo requests" description="When a client books one of your slots, it shows here for you to confirm." />;
  }
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {demos.map((demo) => (
        <li key={demo.id} className="grid gap-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-label">{demo.companyName}</span>
            <Badge tone={demo.status === "confirmed" ? "success" : "warning"} size="sm">
              {DEMO_STATUS_LABELS[demo.status]}
            </Badge>
          </div>
          <p className="m-0 type-body-sm text-ink">
            {formatInZone(demo.startsAt, VA_TIME_ZONE)}
            <span className="text-ink-muted"> · theirs: {formatInZone(demo.startsAt, demo.clientTimezone)}</span>
          </p>
          {demo.note && <p className="m-0 max-w-[60ch] type-body-sm whitespace-pre-line text-ink-muted">{demo.note}</p>}
          {demo.status === "pending" && <AnswerDemoButtons bookingId={demo.id} companyName={demo.companyName} />}
        </li>
      ))}
    </ul>
  );
}
