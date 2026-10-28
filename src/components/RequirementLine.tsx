import { content } from '../lib/content/index.ts';
import type { RequirementItemView, RequirementStatus } from '../lib/content/requirements.ts';
import { Badge, type BadgeTone } from './Badge.tsx';
import styles from './RequirementLine.module.css';
import { SourceNote } from './SourceNote.tsx';

const STATUS_TONE: Record<RequirementStatus, BadgeTone> = {
  ready: 'info',
  gap: 'amber',
  unknown: 'neutral',
};

/**
 * One thing a capability needs: what it is, where it applies, whether the customer has it and, while that is
 * unknown, the question to ask. Render it inside a list.
 */
export function RequirementLine({
  view,
  showStatus,
}: {
  view: RequirementItemView;
  showStatus: boolean;
}) {
  const { item, status } = view;
  const panel = content.licensing.requirementsPanel;
  const { badges } = content.site.ui;
  return (
    <li>
      <strong>{panel.kinds[item.kind]}.</strong> {item.text}{' '}
      {item.appliesTo !== undefined && (
        <Badge tone="outline">
          {panel.levelLabel}: {panel.levels[item.appliesTo]}
        </Badge>
      )}{' '}
      {showStatus && <Badge tone={STATUS_TONE[status]}>{panel.status[status]}</Badge>}{' '}
      {item.status === 'preview' && <Badge tone="outline">{badges.preview}</Badge>}
      {item.status === 'frontier-preview' && <Badge tone="outline">{badges.frontierPreview}</Badge>}
      {status === 'unknown' && item.askPrompt !== undefined && (
        <span className={styles.ask}>
          <strong>{panel.askLabel}:</strong> {item.askPrompt}
        </span>
      )}
      <SourceNote
        sourceIds={item.sourceIds}
        evidence={item.evidence}
        lastVerified={item.lastVerified}
      />
    </li>
  );
}
