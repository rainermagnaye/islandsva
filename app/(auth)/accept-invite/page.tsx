import type { Metadata } from "next";
import { InviteLanding } from "@/features/auth/components/invite-landing";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * Where a new invite link opens. The session arrives in the URL hash and EmailLinkSession sends them on.
 * TEMPORARY until custom SMTP sends the token-hash emails to /auth/confirm (CLAUDE.md §6).
 */
export default function AcceptInvitePage() {
  return <InviteLanding />;
}
