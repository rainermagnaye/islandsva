"use client";

import { RouteError } from "@/components/layout/route-error";
import { routes } from "@/content/routes";

/** Keeps the onboarding layout (noindex, no referrer) when the form fails to load, with a calm way forward. */
export default function OnboardingError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} backHref={routes.home} backLabel="Go to the Islands VA site" />;
}
