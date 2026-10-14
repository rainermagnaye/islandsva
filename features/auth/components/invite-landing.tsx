"use client";

import { useSyncExternalStore } from "react";
import { AuthHeading } from "./auth-heading";
import { inviteLinkOpen, subscribeInviteLink } from "./email-link-session";

/** The invite link only continues when its sign-in tokens are in the address. Otherwise say so. */
export function InviteLanding() {
  // The server cannot see the URL hash, so the first paint assumes the link is intact. The client corrects it.
  const opening = useSyncExternalStore(subscribeInviteLink, inviteLinkOpen, () => true);

  return (
    <AuthHeading title="Accept your invitation">
      {opening
        ? "Choose a password on the next screen. It only takes a moment."
        : "This link didn't sign you in. Ask an admin to send a new invitation."}
    </AuthHeading>
  );
}
