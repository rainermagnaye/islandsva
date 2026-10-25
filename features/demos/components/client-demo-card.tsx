import { Button } from "@/components/ui/button";
import { appRoutes } from "@/content/routes";
import { demoState, formatInZone, isOpenDemo, type ClientDemo } from "../contract";
import { CancelDemoButton } from "./cancel-demo-button";
import { DemoStatusBadge } from "./demo-status-badge";

/**
 * The client's demo call while they have no VA: book one, wait for the VA's answer, or pick another time after
 * a decline, expiry or cancellation. One open demo at a time (the database enforces it).
 */
export function ClientDemoCard({ demo, timeZone }: { demo: ClientDemo | null; timeZone: string | null }) {
  const state = demo ? demoState(demo) : null;

  if (!demo || !state || !isOpenDemo(state)) {
    const lead =
      state === "rejected"
        ? `${demo?.vaName ?? "The VA"} couldn't take that time${demo?.rejectReason ? `: ${demo.rejectReason}` : "."} Please pick another.`
        : state === "expired"
          ? "Your last request wasn't answered in time. Please pick another time."
          : state === "completed"
            ? "Thanks for your demo call. Your Islands VA contact will be in touch about next steps. You can book another if you'd like."
            : "Meet a VA in a short 30-minute call before you're matched.";
    return (
      <div className="grid gap-3">
        <span className="type-label">No VA yet</span>
        <p className="m-0 type-body-sm text-ink-muted">{lead}</p>
        <div>
          <Button href={appRoutes.clientDemo} size="sm" iconLeft="calendar">
            {state ? "Pick another time" : "Book a demo call"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label">Your demo call</span>
        <DemoStatusBadge state={state} />
      </div>
      <p className="m-0 type-body text-ink">{formatInZone(demo.startsAt, timeZone)}</p>
      <p className="m-0 type-body-sm text-ink-muted">
        {state === "confirmed" ? `With ${demo.vaName}. We'll see you then.` : `Waiting for ${demo.vaName} to confirm. We'll email you either way.`}
      </p>
      <CancelDemoButton bookingId={demo.id} />
    </div>
  );
}
