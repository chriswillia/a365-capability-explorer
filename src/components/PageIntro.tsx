import type { ReactNode } from 'react';
import { content } from '../lib/content/index.ts';
import styles from './PageIntro.module.css';

/**
 * The one sentence a page opens with, and its notices behind "About this page", so the first screen shows the page
 * and not the preamble. The footer still carries the disclaimer on every page.
 */
export function PageIntro({ children, notice }: { children: ReactNode; notice?: ReactNode }) {
  return (
    <>
      <p className={styles.lede}>{children}</p>
      {notice !== undefined && (
        <details className={styles.about} data-print-open>
          <summary>{content.site.ui.about.label}</summary>
          <div className={styles.body}>{notice}</div>
        </details>
      )}
    </>
  );
}
