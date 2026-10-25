"use client";

import { lazy, Suspense, type ComponentProps } from "react";
import type { VaRegistration as VaRegistrationForm } from "./va-registration";

// React.lazy keeps the registration form (about 10 KB) out of /va's first load: only a VA whose profile isn't
// approved yet sees it, so an approved VA on the dashboard never downloads it. It still renders on the server.
const VaRegistration = lazy(() => import("./va-registration").then((m) => ({ default: m.VaRegistration })));

export function LazyVaRegistration(props: ComponentProps<typeof VaRegistrationForm>) {
  return (
    <Suspense fallback={null}>
      <VaRegistration {...props} />
    </Suspense>
  );
}
