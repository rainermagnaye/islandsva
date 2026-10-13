import type { Key, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type Column<Row> = {
  /** Unique within the table. */
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  /** Numbers and actions sit at the end (right-aligned, tabular figures). */
  align?: "end";
  /** Hide the label visually (e.g. an actions column) — it's still read out and shown on phone cards. */
  hideLabel?: boolean;
};

type DataTableProps<Row> = {
  /** Always given; visible only with `showCaption`. */
  caption: string;
  showCaption?: boolean;
  /** 3–7 columns. The first is each row's header (and its title as a card on phones). */
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => Key;
  /** Shown instead of the table when there are no rows — usually a compact EmptyState. */
  empty: ReactNode;
};

/**
 * A read-only records table: sticky header on surface-sunken, rows tint on hover, numbers right-aligned.
 * Under 600px of container width every row becomes a card (first column as its title, the rest as
 * label–value pairs). Server-rendered; long lists paginate server-side with Pagination. Styles: the
 * `.data-table` block in app/globals.css.
 */
export function DataTable<Row>({ caption, showCaption, columns, rows, rowKey, empty }: DataTableProps<Row>) {
  if (rows.length === 0) return <>{empty}</>;
  const [first, ...rest] = columns;

  return (
    <div className="data-table">
      <div className="data-table__scroll">
        <table>
          <caption className={showCaption ? undefined : "sr-only"}>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cx(column.align === "end" && "data-table__end")}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                <th scope="row">{first.render(row)}</th>
                {rest.map((column) => (
                  <td key={column.key} data-label={column.hideLabel ? undefined : column.label} className={cx(column.align === "end" && "data-table__end")}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A person or record in a cell: name on top, a muted second line (email, company) below. */
export function CellTitle({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <>
      <span className="block font-semibold text-ink">{title}</span>
      {subtitle && <span className="block text-[0.8125rem] font-normal text-ink-muted">{subtitle}</span>}
    </>
  );
}
