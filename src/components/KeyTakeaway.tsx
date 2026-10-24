import type { ReactNode } from 'react';
import styles from './KeyTakeaway.module.css';

/** The one thing to remember from an exhibit, in a sentence generated from data. */
export function KeyTakeaway({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <div className={styles.takeaway}>
      <p className={styles.headline}>{children}</p>
      {detail !== undefined && <p className={styles.detail}>{detail}</p>}
    </div>
  );
}
