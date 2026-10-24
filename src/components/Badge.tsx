import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'outline' | 'info' | 'amber' | 'neutral' | 'draft';

/** A small status label. The meaning is always in the text; color and icon only reinforce it. */
export function Badge({
  tone = 'outline',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon !== undefined && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
