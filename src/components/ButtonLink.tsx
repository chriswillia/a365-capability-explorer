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
  variant?: 'primary' | 'onDark';
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${styles.button} ${styles[variant]}`}>
      {children}
    </Link>
  );
}
