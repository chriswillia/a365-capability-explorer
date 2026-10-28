import { Badge } from '../../components/Badge.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { content, sourceById } from '../../lib/content/index.ts';
import type { Evidence as EvidenceType, ReviewStatus } from '../../lib/content/schemas.ts';
import { useDepth } from '../../lib/state/depth.ts';
import styles from './Mapping.module.css';

/** The sources behind a statement. The evidence tag and review status are for the Technical view. */
export function Evidence({
  sourceIds,
  evidence,
  reviewStatus,
}: {
  sourceIds: string[];
  evidence: EvidenceType;
  reviewStatus: ReviewStatus;
}) {
  const { depth } = useDepth();
  return (
    <div className={styles.evidence}>
      {depth === 'technical' && (
        <>
          <Badge tone={reviewStatus === 'draft' ? 'draft' : 'outline'}>
            {reviewStatus === 'draft'
              ? content.site.ui.badges.draft
              : content.site.ui.badges.reviewed}
          </Badge>
          <span>{content.site.learn.evidence[evidence]}</span>
        </>
      )}
      {sourceIds.map((id) => {
        const source = sourceById(id);
        if (!source) throw new Error(`Unknown mapping source "${id}"`);
        return (
          <span key={id}>
            <ExternalLink href={source.url}>{source.title}</ExternalLink>
            {source.lastVerified && (
              <>
                {' '}
                ({content.site.learn.verified}:{' '}
                <time dateTime={source.lastVerified}>{source.lastVerified}</time>)
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
