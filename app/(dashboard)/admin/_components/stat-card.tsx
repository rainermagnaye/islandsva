import Link from "next/link";
import type { IconName } from "@/types/icon";
import { IconBadge } from "@/components/ui/icon-badge";

const count = new Intl.NumberFormat("en-US");
const card = "flex items-center gap-4 rounded-lg border border-border bg-surface-card p-6 text-ink no-underline";

/** One headline number on the admin dashboard; with `href`, the whole card links to the list behind it. */
export function StatCard({ label, value, icon, href }: { label: string; value: number; icon: IconName; href?: string }) {
  const body = (
    <>
      <IconBadge name={icon} />
      <div className="grid gap-1">
        <span className="type-body-sm text-ink-muted">{label}</span>
        <span className="type-h2 text-ink">{count.format(value)}</span>
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={`${card} transition-colors hover:border-action-secondary`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  );
}
