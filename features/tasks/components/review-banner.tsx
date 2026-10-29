import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** Tasks the VAs have submitted and the client hasn't decided yet. "Review now" opens the longest-waiting one. */
export function ReviewBanner({ count, href }: { count: number; href: string }) {
  if (count === 0) return null;
  return (
    <section aria-labelledby="review-waiting" className="flex flex-wrap items-center gap-4 rounded-md border border-status-warning bg-status-warning-bg px-5 py-4">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-pill bg-surface-card text-status-warning">
        <Icon name="inbox" />
      </span>
      <div className="grid min-w-0 flex-[1_1_16rem] gap-0.5">
        <h2 id="review-waiting" className="m-0 type-label text-ink">
          {count === 1 ? "1 task is waiting for your review" : `${count} tasks are waiting for your review`}
        </h2>
        <p className="m-0 type-body-sm text-ink">Approve to close it, or request changes and your VA picks it up again.</p>
      </div>
      <Button href={href} variant="secondary">
        Review now
      </Button>
    </section>
  );
}
