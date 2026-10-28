import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { useDepth } from '../lib/state/depth.ts';
import { Badge } from './Badge.tsx';

/** "Verified 2026-10-27": the date the source behind an item was last read. Shown at every detail level. */
export function VerifiedBadge({ date }: { date: string | null | undefined }) {
  if (date === null || date === undefined) return null;
  return <Badge tone="outline">{renderTemplate(content.site.ui.badges.verified, { date })}</Badge>;
}

/**
 * The review state of an item. The verified date is shown to everyone; "Needs SME review" and "SME reviewed" are
 * for the Technical view, so sellers see one clear signal per item rather than a hedge on every card.
 */
export function ReviewBadge({
  reviewStatus,
  verified,
}: {
  reviewStatus: 'draft' | 'reviewed';
  verified?: string | null;
}) {
  const { depth } = useDepth();
  const { badges } = content.site.ui;
  return (
    <>
      <VerifiedBadge date={verified} />
      {depth === 'technical' && (
        <Badge tone={reviewStatus === 'draft' ? 'draft' : 'outline'}>
          {reviewStatus === 'draft' ? badges.draft : badges.reviewed}
        </Badge>
      )}
    </>
  );
}
