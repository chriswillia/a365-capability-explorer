import { Fragment, useId } from 'react';
import { Link } from 'react-router';
import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import type { GuardrailPlan, GuardrailStatus } from '../lib/engine/guardrails.ts';
import { Badge, type BadgeTone } from './Badge.tsx';
import { SourceNote } from './SourceNote.tsx';
import styles from './GuardrailList.module.css';

const TONE: Record<GuardrailStatus, BadgeTone> = {
  ready: 'info',
  gap: 'amber',
  unknown: 'neutral',
};

/**
 * The production checklist in its three gates. Each item says whether the answers show it in place, a gap or still
 * to confirm in words, so color is never the only signal. The compact form is the checklist alone, for the wizard.
 */
export function GuardrailList({
  plan,
  headingLevel = 3,
  compact = false,
}: {
  plan: GuardrailPlan;
  headingLevel?: 3 | 4;
  compact?: boolean;
}) {
  const copy = content.guardrails;
  const prefix = useId();
  const Heading = `h${headingLevel}` as 'h3' | 'h4';
  const nameOf = (id: string) => content.capabilities.find((c) => c.id === id)?.shortName ?? id;
  return (
    <div className={styles.root}>
      <p className={styles.summary}>{renderTemplate(copy.summary, plan.counts)}</p>
      {plan.total === 0 && <p>{copy.empty}</p>}
      {plan.gates.map(({ gate, items }) =>
        items.length === 0 ? null : (
          <section key={gate.id} aria-labelledby={`${prefix}-${gate.id}`} className={styles.gate}>
            <Heading id={`${prefix}-${gate.id}`}>{gate.title}</Heading>
            {!compact && <p className={styles.muted}>{gate.summary}</p>}
            <ul className={styles.items}>
              {items.map(({ item, applies, status }) => (
                <li key={item.id} className={styles.item} data-status={status}>
                  <p className={styles.title}>
                    <strong>{item.title}</strong>{' '}
                    <Badge tone={TONE[status]}>{copy.statusLabels[status]}</Badge>
                    {applies === null && (
                      <>
                        {' '}
                        <Badge tone="outline">{copy.statusLabels.maybe}</Badge>
                      </>
                    )}
                  </p>
                  {!compact && (
                    <>
                      <p>{item.why}</p>
                      <p>
                        <strong>{copy.actionLabel}:</strong> {item.action}
                      </p>
                      {item.capabilityIds.length > 0 && (
                        <p>
                          <strong>{copy.capabilitiesLabel}:</strong>{' '}
                          {item.capabilityIds.map((id, index) => (
                            <Fragment key={id}>
                              {index > 0 && ', '}
                              <Link to={`/capabilities/${id}`}>{nameOf(id)}</Link>
                            </Fragment>
                          ))}
                        </p>
                      )}
                      <SourceNote sourceIds={item.sourceIds} evidence={item.evidence} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
