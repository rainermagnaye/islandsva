"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loginPath, setPasswordPath } from "@/content/routes";
import { establishEmailSession } from "../actions";

// Survives a strict-mode remount, so the one-time tokens are exchanged only once.
let claimed = false;
let opening = false;
const listeners = new Set<() => void>();

function hashTokens() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = params.get("type");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if ((type !== "invite" && type !== "recovery") || !accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function subscribeInviteLink(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function inviteLinkOpen() {
  return opening || hashTokens() !== null;
}

/**
 * Invite and reset links from Supabase's own mailer put the session in the URL hash, which a server
 * route never sees. When that hash is present, store the session and open the password form.
 * TEMPORARY until custom SMTP sends the token-hash emails (CLAUDE.md §6) — then remove this, its mount in
 * app/layout.tsx, /accept-invite and establishEmailSession.
 */
export function EmailLinkSession() {
  const show = useSyncExternalStore(subscribeInviteLink, inviteLinkOpen, () => false);

  useEffect(() => {
    const tokens = hashTokens();
    if (claimed || !tokens) return;

    claimed = true;
    opening = true;
    listeners.forEach((listener) => listener());
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void establishEmailSession(tokens.accessToken, tokens.refreshToken).then((result) => {
      window.location.assign(result.ok ? setPasswordPath : `${loginPath}?error=invalid`);
    });
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-surface-sunken px-4">
      <p className="m-0 type-body text-ink">Opening your invitation…</p>
    </div>
  );
}
