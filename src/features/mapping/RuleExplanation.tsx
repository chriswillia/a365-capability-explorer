import { Link } from 'react-router';
import { content } from '../../lib/content/index.ts';
import type { Rule } from '../../lib/content/schemas.ts';
import { describeCondition } from '../../lib/engine/conditions.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { Evidence } from './Evidence.tsx';
import styles from './Mapping.module.css';

export function RuleExplanation({ rule, capabilityId }: { rule: Rule; capabilityId?: string }) {
  const { depth } = useDepth();
  const copy = content.site.mapping;
  return (
    <div className={styles.reason}>
      <p>{rule.description}</p>
      <p>{describeCondition(rule.when, content.questions, copy.condition)}</p>
      {depth === 'technical' && (
        <p>
          <Link to={`/methodology#rule-${rule.id}`}>
            <code>{rule.id}</code>
          </Link>{' '}
          · {copy.origin[rule.scope]}
        </p>
      )}
      <ul>
        {rule.recommend
          .filter((r) => capabilityId === undefined || r.capability === capabilityId)
          .map((r) => (
            <li key={r.capability}>
              {capabilityId === undefined && (
                <Link className={styles.cellLink} to={`/capabilities/${r.capability}`}>
                  {content.capabilities.find((c) => c.id === r.capability)!.shortName}
                </Link>
              )}
              <p>
                <strong>{copy.levels[r.level]}</strong> — {r.because}
              </p>
              {depth === 'technical' && r.detail && <p>{r.detail}</p>}
              <Evidence
                sourceIds={r.sourceIds}
                evidence={r.evidence}
                reviewStatus={rule.reviewStatus}
              />
            </li>
          ))}
      </ul>
      {capabilityId === undefined &&
        rule.advisories.map((id) => {
          const advisory = content.advisories.find((a) => a.id === id)!;
          return (
            <div key={id}>
              <p>
                <strong>{advisory.title}</strong> — {advisory.body}
              </p>
              <Evidence {...advisory} />
            </div>
          );
        })}
    </div>
  );
}
