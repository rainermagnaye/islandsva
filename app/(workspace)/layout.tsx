import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { appRoutes } from "@/content/routes";
import { AccountNav } from "@/features/auth/components/account-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Portal shell. The header frame is static (instant on every navigation); only the account controls read
 * the session, behind their own Suspense boundary. On admin pages the logo inset matches the sidebar
 * (see `.portal-header` in globals.css). Access is checked by each page, not here.
 * Search is a slot so its script stays off the VA pages, which are at the size limit.
 */
export default function DashboardLayout({ children, search }: { children: ReactNode; search: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface-card">
        <div className="portal-header mx-auto grid min-h-16 max-w-(--container-max) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 md:grid-cols-[1fr_minmax(16rem,32rem)_1fr] md:px-8">
          <Logo href={appRoutes.dashboard} />
          <div className="min-w-0 md:w-full">{search}</div>
          <div className="justify-self-end">
            <Suspense>
              <AccountNav />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="main" className="min-h-[calc(100dvh-4rem)] bg-surface-page">
        {children}
      </main>
    </>
  );
}
