import { ViewTransition, type ReactNode } from "react";
import { site } from "@/content/site";
import { Footer } from "./footer";
import { NavBar } from "./nav-bar";

/** Nav, main landmark and footer around every public page (marketing layout and the 404 page). */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <NavBar links={site.nav} cta={site.cta} />
      {/* Crossfades page content on navigation (browser View Transitions; no-op where unsupported). */}
      <ViewTransition>
        <main id="main">{children}</main>
      </ViewTransition>
      <Footer />
    </>
  );
}
