import { useId, type Key, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Checkbox } from "./checkbox";
import { TableSelection } from "./table-selection";

export type Column<Row> = {
  /** Unique within the table. */
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  /** Numbers and actions sit at the end (right-aligned, tabular figures). */
  align?: "end";
  /** Show the whole value. Status badges must not be cut off with an ellipsis. */
  nowrap?: boolean;
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
  /** Keep the column headers and show `empty` in the body, inside the same rounded card. */
  keepHeader?: boolean;
  /** Drop the table's own border and radius when a parent card already draws them. */
  attached?: boolean;
  /** Name read with each row's checkbox. Defaults on for record lists. */
  selectable?: boolean;
  rowLabel?: (row: Row) => string;
};

function keyOf<Row>(row: Row, rowKey: (row: Row) => Key) {
  return String(rowKey(row));
}

/**
 * A read-only records table: a selection checkbox, sticky header on surface-sunken, rows tint on hover,
 * numbers right-aligned. Under 600px of container width every row becomes a card. Styles: the
 * `.data-table` block in app/globals.css.
 */
export function DataTable<Row>({
  caption,
  showCaption,
  columns,
  rows,
  rowKey,
  empty,
  keepHeader = false,
  attached = false,
  selectable = true,
  rowLabel,
}: DataTableProps<Row>) {
  const tableId = useId();

  if (rows.length === 0 && !keepHeader && !attached) return <>{empty}</>;
  const [first, ...rest] = columns;
  const span = columns.length + (selectable ? 1 : 0);

  return (
    <TableSelection className="data-table">
      <div className={cx("data-table__scroll", attached && "data-table__scroll--plain")}>
        <table>
          <caption className={showCaption ? undefined : "sr-only"}>{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="data-table__check">
                  <Checkbox id={`${tableId}-all`} hideLabel label="Select all" disabled={rows.length === 0} />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cx(column.align === "end" && "data-table__end", column.nowrap && "data-table__nowrap")}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={span} className="data-table__empty">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = keyOf(row, rowKey);
                return (
                  <tr key={id}>
                    {selectable && (
                      <td className="data-table__check">
                        <Checkbox id={`${tableId}-${id}`} hideLabel label={`Select ${rowLabel?.(row) ?? "row"}`} />
                      </td>
                    )}
                    <th scope="row">{first.render(row)}</th>
                    {rest.map((column) => (
                      <td key={column.key} data-label={column.hideLabel ? undefined : column.label} className={cx(column.align === "end" && "data-table__end", column.nowrap && "data-table__nowrap")}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </TableSelection>
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
