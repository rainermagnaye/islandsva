import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { appRoutes } from "@/content/routes";
import { AccountNav } from "@/features/auth/components/account-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Portal shell. The header frame is static (instant on every navigation); only the account controls read
 * the session, behind their own Suspense boundary. On admin pages the logo inset matches the sidebar
 * (see `.portal-header` in globals.css). Access is checked by each page, not here.
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border bg-surface-card">
        <div className="portal-header mx-auto flex min-h-16 max-w-(--container-max) items-center gap-4 px-4 md:px-8">
          <Logo href={appRoutes.dashboard} className="mr-auto" />
          <Suspense>
            <AccountNav />
          </Suspense>
        </div>
      </header>
      <main id="main" className="min-h-[calc(100dvh-4rem)] bg-surface-page">
        {children}
      </main>
    </>
  );
}
