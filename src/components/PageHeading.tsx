import type { ReactNode } from 'react';
import styles from './PageHeading.module.css';

/** The page's h1. Focus moves here after navigation, so keyboard and screen reader users land at the top. */
export function PageHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 tabIndex={-1} data-page-title className={`${styles.heading} ${className ?? ''}`}>
      {children}
    </h1>
  );
}
