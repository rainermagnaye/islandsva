import { cx } from "@/lib/cx";
import { Icon } from "./icon";

/** Short list with success checkmarks (package features, highlights). Layout and type via `className`. */
export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cx("m-0 grid list-none gap-2 p-0", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Icon name="check" size={18} className="mt-[3px] text-status-success" />
          {item}
        </li>
      ))}
    </ul>
  );
}
