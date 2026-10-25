import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Registration link: logo and the packet, no marketing chrome and no sign-in. */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="min-h-dvh bg-surface-sunken px-4 py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <Logo className="justify-self-center" />
        {children}
      </div>
    </main>
  );
}
