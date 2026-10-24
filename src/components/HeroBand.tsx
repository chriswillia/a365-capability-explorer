import type { ReactNode } from 'react';
import styles from './HeroBand.module.css';

/** The landing band: the Frontier gradient with a quiet horizon motif. The motif is decorative. */
export function HeroBand({
  eyebrow,
  title,
  tagline,
  lede,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  tagline: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.hero}>
      <svg
        className={styles.horizon}
        viewBox="0 0 1200 88"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M-100 84 Q600 30 1300 84" />
          <path d="M-100 84 Q600 52 1300 84" />
          <path d="M-100 84 Q600 70 1300 84" />
          <line x1="0" y1="84" x2="1200" y2="84" />
        </g>
        <circle cx="600" cy="40" r="6" fill="currentColor" />
      </svg>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        {title}
        <p className={styles.tagline}>{tagline}</p>
        <p className={styles.lede}>{lede}</p>
        {children !== undefined && <div className={styles.actions}>{children}</div>}
      </div>
    </div>
  );
}
