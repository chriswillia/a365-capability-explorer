import type { ReactNode } from 'react';
import styles from './PageContainer.module.css';

/** The standard page column: centered, padded, and optionally narrow for reading. */
export function PageContainer({
  narrow = false,
  children,
}: {
  narrow?: boolean;
  children: ReactNode;
}) {
  return <div className={`${styles.page} ${narrow ? styles.narrow : ''}`}>{children}</div>;
}
