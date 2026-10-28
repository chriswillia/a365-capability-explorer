import { useEffect, useRef, useState, type ReactNode } from 'react';
import { content } from '../lib/content/index.ts';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Render this column's cell as the row header (a th with scope="row"). */
  rowHeader?: boolean;
  /** Right-align numbers. */
  numeric?: boolean;
  /** Keep short values such as "Wave 1" on one line. */
  nowrap?: boolean;
}

const cellClass = <T,>(column: Column<T>, corner = false): string | undefined => {
  const names = [
    column.numeric === true ? styles.numeric : undefined,
    column.nowrap === true ? styles.nowrap : undefined,
    corner ? styles.corner : undefined,
  ].filter((name): name is string => name !== undefined);
  return names.length > 0 ? names.join(' ') : undefined;
};

/** Whether the table inside a scroll region is wider than the region, so a reader needs to scroll sideways. */
function useOverflowsSideways() {
  const region = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = region.current;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    // The observer reports once when it starts, then again whenever the region or the table changes size.
    const observer = new ResizeObserver(() =>
      setOverflows(element.scrollWidth > element.clientWidth + 1),
    );
    observer.observe(element);
    if (element.firstElementChild !== null) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return { region, overflows };
}

/**
 * A plain, accessible table: a caption, column headers and one row header per row.
 * When scrollLabel is set, the table sits in a focusable scroll region so keyboard users can scroll it. The
 * row header stays in view while the rest scrolls, and a hint appears when the table is wider than the screen.
 */
export function DataTable<T>({
  caption,
  hideCaption = false,
  columns,
  rows,
  rowKey,
  scrollLabel,
}: {
  caption: string;
  /** Keep the caption for assistive technology but hide it visually, when a heading already names the table. */
  hideCaption?: boolean;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  scrollLabel?: string;
}) {
  const { region, overflows } = useOverflowsSideways();
  const table = (
    <table className={styles.table}>
      <caption className={hideCaption ? 'visually-hidden' : styles.caption}>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th
              key={column.key}
              scope="col"
              className={cellClass(column, index === 0 && column.rowHeader === true)}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) =>
              column.rowHeader === true ? (
                <th key={column.key} scope="row" className={styles.rowHeader}>
                  {column.render(row)}
                </th>
              ) : (
                <td key={column.key} className={cellClass(column)}>
                  {column.render(row)}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (scrollLabel === undefined) return table;
  return (
    <>
      {overflows && (
        <p className={styles.hint} aria-hidden="true">
          {content.site.ui.scrollHint}
        </p>
      )}
      <div
        ref={region}
        className={styles.scroll}
        role="region"
        aria-label={scrollLabel}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable
        tabIndex={0}
      >
        {table}
      </div>
    </>
  );
}
