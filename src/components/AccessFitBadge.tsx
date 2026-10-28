import { accessFit } from '../lib/content/access-fit.ts';
import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { Badge } from './Badge.tsx';

/**
 * Whether Microsoft's documentation treats delegated access and own access differently for a capability.
 * It reads only the sourced statements, so silence shows as "not split by Microsoft", never as "the same".
 */
export function AccessFitBadge({ capabilityId }: { capabilityId: string }) {
  const { badges } = content.site.ui;
  const { columns } = content.accessPatterns;
  const fit = accessFit(content, capabilityId);
  if (fit.kind === 'differs') return <Badge tone="amber">{badges.accessDiffers}</Badge>;
  if (fit.kind === 'stated')
    return (
      <Badge tone="info">
        {renderTemplate(badges.accessStated, {
          patterns: fit.patterns.map((key) => columns[key].toLowerCase()).join(', '),
        })}
      </Badge>
    );
  return <Badge tone="neutral">{badges.accessUnsplit}</Badge>;
}
