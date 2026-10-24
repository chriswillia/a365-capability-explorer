import type { ReactNode } from 'react';
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

const cellClass = <T,>(column: Column<T>): string | undefined => {
  const names = [
    column.numeric === true ? styles.numeric : undefined,
    column.nowrap === true ? styles.nowrap : undefined,
  ].filter((name): name is string => name !== undefined);
  return names.length > 0 ? names.join(' ') : undefined;
};

/**
 * A plain, accessible table: a caption, column headers and one row header per row.
 * When scrollLabel is set, the table sits in a focusable scroll region so keyboard users can scroll it.
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
  const table = (
    <table className={styles.table}>
      <caption className={hideCaption ? 'visually-hidden' : styles.caption}>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={cellClass(column)}>
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
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable
    <div className={styles.scroll} role="region" aria-label={scrollLabel} tabIndex={0}>
      {table}
    </div>
  );
}
