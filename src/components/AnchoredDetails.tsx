import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import styles from './AnchoredDetails.module.css';

/**
 * A panel that stays closed until it is needed, and opens by itself when a link to it is followed. It opens for
 * printing, so a closed panel is not missing from the paper.
 */
export function AnchoredDetails({
  id,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const element = useRef<HTMLDetailsElement>(null);
  const { hash } = useLocation();

  useEffect(() => {
    let anchor = hash.slice(1);
    try {
      anchor = decodeURIComponent(anchor);
    } catch {
      // A malformed address names nothing, so the panel stays as it is.
    }
    if (anchor === id && element.current !== null) element.current.open = true;
  }, [hash, id]);

  return (
    <details id={id} ref={element} open={defaultOpen} className={styles.panel} data-print-open>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
