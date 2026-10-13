import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { NavDrawer } from "./nav-drawer";
import { NavLinks, type NavLink } from "./nav-links";
import { LoginLink } from "./login-link";

type NavBarProps = {
  /** ≤ 5 links. */
  links: readonly NavLink[];
  /** The page's single primary action. */
  cta?: NavLink;
};

/**
 * Global top bar. Adapts to its own width (container queries): logo + menu < 640px, adds the CTA
 * from 640px, 72px tall with 3 inline links from 768px, all links from 1024px. Gains elevation on
 * scroll via a CSS scroll-driven animation (no JS). The client-login icon is always visible.
 */
export function NavBar({ links, cta }: NavBarProps) {
  return (
    <header className="nav-elevate sticky top-0 z-40 @container border-b border-border bg-surface-card">
      <nav aria-label="Main" className="flex h-16 items-center gap-4 px-4 @min-[768px]:h-[72px] @min-[768px]:px-6">
        <Logo className="mr-auto" />
        <NavLinks links={links} variant="inline" />
        <LoginLink />
        {cta && (
          <div className="hidden @min-[640px]:block">
            <Button href={cta.href} size="sm">
              {cta.label}
            </Button>
          </div>
        )}
        <NavDrawer>
          <NavLinks links={links} variant="drawer" />
          {cta && (
            <Button href={cta.href} block>
              {cta.label}
            </Button>
          )}
        </NavDrawer>
      </nav>
    </header>
  );
}
