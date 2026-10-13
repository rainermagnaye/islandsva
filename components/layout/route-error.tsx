"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "./status-panel";

type RouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  /** Where "back" goes: the home of the area the error happened in. */
  backHref: string;
  backLabel: string;
};

/**
 * Body of every route group's error.tsx. Server errors arrive with a generic message and a `digest` that
 * matches the server log, so we show the digest, never the message.
 */
export function RouteError({ error, retry, backHref, backLabel }: RouteErrorProps) {
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
          <Button href={backHref} variant="ghost">
            {backLabel}
          </Button>
        </>
      }
    >
      <p>This page didn&apos;t load properly. Please try again — if it keeps happening, contact us and we&apos;ll look into it.</p>
      {error.digest && <p className="type-body-sm">Reference: {error.digest}</p>}
    </StatusPanel>
  );
}
