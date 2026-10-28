import { useId, useState } from 'react';
import { Link } from 'react-router';
import { content } from '../lib/content/index.ts';
import type { GlossaryEntry } from '../lib/content/schemas.ts';
import { useDepth } from '../lib/state/depth.ts';
import styles from './GlossaryTerm.module.css';

export function GlossaryTerm({ text, entry }: { text: string; entry: GlossaryEntry }) {
  const id = useId();
  const { depth } = useDepth();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className={styles.term}
      onMouseEnter={() => setDismissed(false)}
      onMouseLeave={() => setDismissed(false)}
    >
      <Link
        to={`/learn#glossary-${entry.id}`}
        aria-describedby={id}
        onBlur={() => setDismissed(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDismissed(true);
        }}
      >
        {text}
      </Link>
      <span
        id={id}
        role="tooltip"
        className={`${styles.tooltip} ${dismissed ? styles.dismissed : ''}`}
      >
        {entry.definition}
        {depth === 'technical' && (
          <>
            {' '}
            {entry.reviewStatus === 'draft'
              ? content.site.ui.badges.draft
              : content.site.ui.badges.reviewed}
          </>
        )}
      </span>
    </span>
  );
}
