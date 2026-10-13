"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileProps = {
  siteKey: string;
  /** Receives the widget id once rendered, so the form can reset this widget after a failed submit. */
  onRender?: (widgetId: string | null) => void;
};

/**
 * Cloudflare Turnstile, rendered explicitly. Implicit rendering only scans the page once, when the script
 * first loads — after a client-side navigation back to the form the widget would never appear and every
 * submit would fail verification. The token lands in a hidden `cf-turnstile-response` input in the form.
 */
export function Turnstile({ siteKey, onRender }: TurnstileProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    // Guard: both the script's onReady and the mount effect call this; render exactly once per mount.
    if (!container.current || widgetId.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      appearance: "interaction-only",
      theme: "auto",
    }) ?? null;
    onRender?.(widgetId.current);
  }, [siteKey, onRender]);

  useEffect(() => {
    // Script already loaded (client-side navigation): onReady may not fire again, so render on mount too.
    render();
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [render]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={render} />
      <div ref={container} />
    </>
  );
}
