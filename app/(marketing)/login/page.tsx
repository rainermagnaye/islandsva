import type { Metadata } from "next";
import { StatusPanel } from "@/components/layout/status-panel";
import { Button } from "@/components/ui/button";
import { routes } from "@/content/routes";

export const metadata: Metadata = {
  title: "Client login",
  robots: { index: false },
};

// Placeholder until the client portal ships (M2).
export default function LoginPage() {
  return (
    <StatusPanel
      icon="user"
      title="The client portal is coming soon"
      actions={
        <>
          <Button href={routes.contact}>Contact us</Button>
          <Button href={routes.home} variant="ghost">
            Back to home
          </Button>
        </>
      }
    >
      <p>
        Soon you&apos;ll be able to see your VA&apos;s tasks, book calls and manage your plan here. Until then, your VA and our
        team are a message away.
      </p>
    </StatusPanel>
  );
}
