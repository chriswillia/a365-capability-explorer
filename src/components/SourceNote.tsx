import { Fragment } from 'react';
import { content, sourceById } from '../lib/content/index.ts';
import type { Evidence, Source } from '../lib/content/schemas.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { useDepth } from '../lib/state/depth.ts';
import { Badge } from './Badge.tsx';
import { ExternalLink } from './ExternalLink.tsx';
import styles from './SourceNote.module.css';

/**
 * The Microsoft sources for a statement, behind a one-line toggle that says how many there are and when they were
 * read. The list opens in the Technical view and in print, and the evidence tag (stated, inferred or
 * recommendation) is for the Technical view.
 */
export function SourceNote({
  sourceIds,
  evidence,
  lastVerified,
}: {
  sourceIds: readonly string[];
  evidence?: Evidence;
  lastVerified?: string | null;
}) {
  const { site } = content;
  const { depth } = useDepth();
  const sources = sourceIds.flatMap((id): Source[] => {
    const source = sourceById(id);
    return source === undefined ? [] : [source];
  });
  const dated = lastVerified !== undefined && lastVerified !== null;
  const summary = renderTemplate(
    dated ? site.ui.exhibit.sourcesSummary : site.ui.exhibit.sourcesSummaryUndated,
    { count: sources.length, date: lastVerified ?? '' },
  );
  return (
    // The key makes the toggle start again, open or closed, when the detail level changes.
    <details key={depth} className={styles.note} open={depth === 'technical'} data-print-open>
      <summary>{summary}</summary>
      <p className={styles.list}>
        {depth === 'technical' && evidence !== undefined && (
          <>
            <Badge tone="outline">{site.learn.evidence[evidence]}</Badge>{' '}
          </>
        )}
        {site.ui.exhibit.sourcePrefix}{' '}
        {sources.map((source, index) => (
          <Fragment key={source.id}>
            {index > 0 && '; '}
            <ExternalLink href={source.url}>{source.title}</ExternalLink>
          </Fragment>
        ))}
        {dated && (
          <>
            {' '}
            · {site.learn.verified}: <time dateTime={lastVerified}>{lastVerified}</time>
          </>
        )}
      </p>
    </details>
  );
}
