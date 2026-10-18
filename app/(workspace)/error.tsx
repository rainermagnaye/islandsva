"use client";

import { RouteError } from "@/components/layout/route-error";
import { appRoutes } from "@/content/routes";

/** Portal pages: the header stays, the page area shows this. */
export default function DashboardError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} backHref={appRoutes.dashboard} backLabel="Back to dashboard" />;
}
