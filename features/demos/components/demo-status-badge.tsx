import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DEMO_STATUS_LABELS, type DemoStatus } from "../contract";

// Waiting on someone = warning, set = success, done = info, closed without a call = neutral.
const TONES: Record<DemoStatus, BadgeTone> = {
  pending: "warning",
  confirmed: "success",
  completed: "info",
  rejected: "neutral",
  cancelled: "neutral",
  expired: "neutral",
};

/** A demo's state as every screen shows it. Pass what it is now (`demoState`), not the stored status. */
export function DemoStatusBadge({ state }: { state: DemoStatus }) {
  return (
    <Badge tone={TONES[state]} size="sm">
      {DEMO_STATUS_LABELS[state]}
    </Badge>
  );
}
