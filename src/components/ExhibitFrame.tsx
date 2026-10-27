import { Fragment, useId, type ReactNode } from 'react';
import { content, sourceById } from '../lib/content/index.ts';
import type { Source } from '../lib/content/schemas.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { ExternalLink } from './ExternalLink.tsx';
import styles from './ExhibitFrame.module.css';

/**
 * One exhibit: a small-caps eyebrow, a full-sentence takeaway as the title, the evidence, and a source line.
 * Titles are generated from data by the caller; this component only lays them out.
 */
export function ExhibitFrame({
  number,
  label,
  title,
  id,
  sourceIds = [],
  sourceNote,
  children,
}: {
  number: number;
  label: string;
  title: string;
  /** Lets a contents list link to this exhibit. */
  id?: string;
  sourceIds?: string[];
  sourceNote?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const { exhibit } = content.site.ui;
  const sources = sourceIds.flatMap((id): Source[] => {
    const source = sourceById(id);
    return source === undefined ? [] : [source];
  });

  return (
    <section id={id} className={styles.exhibit} aria-labelledby={headingId}>
      <p className={styles.eyebrow}>{renderTemplate(exhibit.eyebrow, { number, label })}</p>
      <h2 id={headingId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      <p className={styles.source}>
        {exhibit.sourcePrefix}{' '}
        {sources.map((source, index) => (
          <Fragment key={source.id}>
            {index > 0 && '; '}
            <ExternalLink href={source.url}>{source.title}</ExternalLink>
          </Fragment>
        ))}
        {sources.length > 0 && sourceNote !== undefined && '. '}
        {sourceNote}
      </p>
    </section>
  );
}
