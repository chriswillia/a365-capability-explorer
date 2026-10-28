import { content, sourceById } from '../lib/content/index.ts';
import type { Evidence, ReviewStatus } from '../lib/content/schemas.ts';
import { useDepth } from '../lib/state/depth.ts';
import { Badge } from './Badge.tsx';
import { ExternalLink } from './ExternalLink.tsx';

export function LearningEvidence({
  item,
}: {
  item: {
    sourceId: string;
    evidence: Evidence;
    reviewStatus: ReviewStatus;
    lastVerified: string | null;
  };
}) {
  const { site } = content;
  const { depth } = useDepth();
  const source = sourceById(item.sourceId);
  return (
    <div>
      {depth === 'technical' && (
        <p>
          <Badge tone="outline">{site.learn.evidence[item.evidence]}</Badge>{' '}
          <Badge tone={item.reviewStatus === 'draft' ? 'draft' : 'outline'}>
            {item.reviewStatus === 'draft' ? site.ui.badges.draft : site.ui.badges.reviewed}
          </Badge>
        </p>
      )}
      <p>
        {site.ui.exhibit.sourcePrefix}{' '}
        {source && <ExternalLink href={source.url}>{source.title}</ExternalLink>}
        {item.lastVerified !== null && (
          <>
            {' '}
            · {site.learn.verified}: <time dateTime={item.lastVerified}>{item.lastVerified}</time>
          </>
        )}
      </p>
    </div>
  );
}
