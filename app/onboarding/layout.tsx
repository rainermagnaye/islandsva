import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";

// The client's onboarding form, reached from an emailed link. Never indexed, and no referrer leaves the page,
// because its URL carries the single-use token.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Logo and one wide card: the form is longer than the sign-in screens. */
export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return (
    <main id="main" className="grid min-h-dvh justify-items-center bg-surface-sunken px-4 py-12">
      <div className="grid w-full max-w-2xl content-start gap-8">
        <Logo className="justify-self-center" />
        {children}
      </div>
    </main>
  );
}
