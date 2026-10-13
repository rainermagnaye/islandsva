import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Sign-in screens: logo and one centred card, no marketing chrome. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-surface-sunken px-4 py-12">
      <div className="grid w-full max-w-[28rem] gap-8">
        <Logo className="justify-self-center" />
        <div className="grid gap-6 rounded-xl border border-border bg-surface-card p-6 elevation-sm md:p-8">{children}</div>
      </div>
    </main>
  );
}
