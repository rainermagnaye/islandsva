"use client";

import { useEffect } from "react";
import { StatusPanel } from "@/components/layout/status-panel";
import { Button } from "@/components/ui/button";
import { routes } from "@/content/routes";

/**
 * Error boundary for public pages: the nav and footer stay, the page area shows this. Server-side errors
 * arrive with a generic message and a `digest` that matches the server log, so we show the digest, never the message.
 */
export default function MarketingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPanel
      icon="alert"
      title="Something went wrong"
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <Button href={routes.home} variant="ghost">
            Back to home
          </Button>
        </>
      }
    >
      <p>This page didn&apos;t load properly. Please try again — if it keeps happening, contact us and we&apos;ll look into it.</p>
      {error.digest && <p className="type-body-sm">Reference: {error.digest}</p>}
    </StatusPanel>
  );
}
