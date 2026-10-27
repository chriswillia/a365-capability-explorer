import { Link } from 'react-router';
import styles from './KpiStrip.module.css';

export interface Kpi {
  id: string;
  label: string;
  value: string;
  note?: string;
  /** Makes the whole tile a link to what the number counts. */
  href?: string;
  /** A separate link for the note, when it counts something else. */
  noteHref?: string;
}

/** A row of headline numbers. In the DOM the label comes before the value, so a screen reader hears "label: value". */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <dl className={styles.strip}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`${styles.tile} ${item.href === undefined ? '' : styles.linked}`}
        >
          <dt className={styles.label}>
            {item.href === undefined ? (
              item.label
            ) : (
              <Link className={styles.link} to={item.href}>
                {item.label}
              </Link>
            )}
          </dt>
          <dd className={styles.value}>{item.value}</dd>
          {item.note !== undefined && (
            <dd className={styles.note}>
              {item.noteHref === undefined ? (
                item.note
              ) : (
                <Link className={styles.noteLink} to={item.noteHref}>
                  {item.note}
                </Link>
              )}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
