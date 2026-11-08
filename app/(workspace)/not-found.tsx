import { StatusPanel } from "@/components/layout/status-panel";
import { Button } from "@/components/ui/button";
import { dashboardPath } from "@/content/routes";

/**
 * Portal pages that call notFound() (a removed record, an id the caller may not see): the portal header
 * stays and the page area shows this. Without it Next falls back to app/not-found.tsx, whose SiteShell
 * would add the marketing navbar and footer under the portal header.
 */
export default function WorkspaceNotFound() {
  return (
    <StatusPanel icon="search" title="We couldn't find that page" actions={<Button href={dashboardPath}>Back to dashboard</Button>}>
      <p>It may have been removed, or the link might be mistyped.</p>
    </StatusPanel>
  );
}
