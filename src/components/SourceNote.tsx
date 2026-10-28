import { Fragment } from 'react';
import { content, sourceById } from '../lib/content/index.ts';
import type { Evidence, Source } from '../lib/content/schemas.ts';
import { useDepth } from '../lib/state/depth.ts';
import { Badge } from './Badge.tsx';
import { ExternalLink } from './ExternalLink.tsx';
import styles from './SourceNote.module.css';

/**
 * The Microsoft sources and the date they were read, as one quiet line under a statement. The evidence tag
 * (stated, inferred or recommendation) is for the Technical view.
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
  return (
    <p className={styles.note}>
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
      {lastVerified !== undefined && lastVerified !== null && (
        <>
          {' '}
          · {site.learn.verified}: <time dateTime={lastVerified}>{lastVerified}</time>
        </>
      )}
    </p>
  );
}
