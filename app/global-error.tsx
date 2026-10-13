"use client";

import { StatusPanel } from "@/components/layout/status-panel";
import { Button } from "@/components/ui/button";
import { site } from "@/content/site";
import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout. It replaces the whole document, so it brings its own
 * <html>, <body> and styles (fonts fall back to the system stack) and can't use metadata exports.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <title>{`Something went wrong · ${site.name}`}</title>
        <main id="main">
          <StatusPanel icon="alert" title="Something went wrong" actions={<Button onClick={() => retry()}>Try again</Button>}>
            <p>{site.name} didn&apos;t load properly. Please try again in a moment.</p>
            {error.digest && <p className="type-body-sm">Reference: {error.digest}</p>}
          </StatusPanel>
        </main>
      </body>
    </html>
  );
}
