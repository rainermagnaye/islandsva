import type { Metadata } from "next";
import { InviteLanding } from "@/features/auth/components/invite-landing";

export const metadata: Metadata = { title: "Accept invitation" };

/** Where a new invite link opens. The session arrives in the URL hash and EmailLinkSession sends them on. */
export default function AcceptInvitePage() {
  return <InviteLanding />;
}
