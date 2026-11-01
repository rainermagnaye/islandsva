"use client";

import { formatBookingWhen, type DiscoveryRequest } from "../contract";

/** Requested discovery calls. Opening one uses the same modal as a calendar event. */
export function DiscoveryInbox({
  requests,
  onOpen,
}: {
  requests: readonly DiscoveryRequest[];
  onOpen: (id: string) => void;
}) {
  if (requests.length === 0) return null;
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {requests.map((request) => (
        <li key={request.meetingId}>
          <button
            type="button"
            onClick={() => onOpen(request.meetingId)}
            className="grid w-full gap-1 rounded-md bg-surface-sunken px-3.5 py-3 text-left text-ink hover:bg-action-ghost-hover"
          >
            <span className="type-label">{request.companyName || request.fullName}</span>
            <span className="type-body-sm text-ink-muted">{formatBookingWhen(request.startsAt, request.endsAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
