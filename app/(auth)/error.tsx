"use client";

import { RouteError } from "@/components/layout/route-error";
import { appRoutes } from "@/content/routes";

export default function AuthError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} backHref={appRoutes.login} backLabel="Back to sign in" />;
}
