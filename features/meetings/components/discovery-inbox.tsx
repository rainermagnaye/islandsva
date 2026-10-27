"use client";

import { useToast } from "@/components/ui/toast";
import { formatBookingWhen, type DiscoveryRequest } from "../contract";
import { DiscoveryActions } from "./discovery-actions";

/** Requested discovery calls for a Lead Gen. Confirming assigns the call to them. */
export function DiscoveryInbox({ requests }: { requests: readonly DiscoveryRequest[] }) {
  const toast = useToast();
  if (requests.length === 0) return null;
  return (
    <section className="grid gap-4">
      <h2 className="m-0 type-h2">Discovery calls</h2>
      <ul className="m-0 grid list-none gap-4 p-0">
        {requests.map((request) => (
          <li key={request.meetingId} className="grid gap-4 rounded-lg border border-border bg-surface-card p-4">
            <div className="grid gap-1">
              <p className="m-0 type-label">{request.companyName || request.fullName}</p>
              <p className="m-0 type-body-sm text-ink-muted">{formatBookingWhen(request.startsAt, request.endsAt)}</p>
            </div>
            <DiscoveryActions meetingId={request.meetingId} canConfirm onDone={(message) => toast.show({ title: message, tone: "success" })} />
          </li>
        ))}
      </ul>
    </section>
  );
}
