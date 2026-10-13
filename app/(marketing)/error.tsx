"use client";

import { RouteError } from "@/components/layout/route-error";
import { routes } from "@/content/routes";

/** Public pages: the nav and footer stay, the page area shows this. */
export default function MarketingError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} backHref={routes.home} backLabel="Back to home" />;
}
