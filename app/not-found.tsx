import { SiteShell } from "@/components/layout/site-shell";
import { StatusPanel } from "@/components/layout/status-panel";
import { Button } from "@/components/ui/button";
import { routes } from "@/content/routes";

export default function NotFound() {
  return (
    <SiteShell>
      <StatusPanel
        icon="search"
        title="We couldn't find that page"
        actions={
          <>
            <Button href={routes.home}>Back to home</Button>
            <Button href={routes.contact} variant="ghost">
              Contact us
            </Button>
          </>
        }
      >
        <p>It may have moved, or the link might be mistyped. Let&apos;s get you back on track.</p>
      </StatusPanel>
    </SiteShell>
  );
}
