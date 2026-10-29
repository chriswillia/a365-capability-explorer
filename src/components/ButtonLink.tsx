import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './ButtonLink.module.css';

/** A router link that looks like a button. Use "onDark" on the gradient hero. */
export function ButtonLink({
  to,
  variant = 'primary',
  children,
}: {
  to: string;
  variant?: 'primary' | 'onDark' | 'onDarkOutline';
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${styles.button} ${styles[variant]}`}>
      {children}
    </Link>
  );
}

/** A button that looks like the primary ButtonLink, for an action that saves something instead of going somewhere. */
export function ActionButton({
  onClick,
  describedBy,
  children,
}: {
  onClick: () => void;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles.primary} ${styles.action}`}
      aria-describedby={describedBy}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
