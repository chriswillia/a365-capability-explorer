import { Link } from 'react-router';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { content, sourceById } from '../../lib/content/index.ts';
import { describeCondition } from '../../lib/engine/conditions.ts';
import type { AssessmentResult, InScope } from '../../lib/engine/evaluate.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { Evidence } from './Evidence.tsx';
import styles from './Mapping.module.css';

function CapabilityLinks({ ids }: { ids: string[] }) {
  return (
    <ul className={styles.links}>
      {ids.map((id) => (
        <li key={id}>
          <Link to={`/capabilities/${id}`}>
            {content.capabilities.find((c) => c.id === id)!.shortName}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MappingReport({ result }: { result: AssessmentResult }) {
  const { depth } = useDepth();
  const technical = depth === 'technical';
  const copy = content.site.mapping;
  const columns: Column<InScope>[] = [
    {
      key: 'capability',
      header: content.site.capabilities.columns.capability,
      rowHeader: true,
      render: (r) => (
        <Link className={styles.cellLink} to={`/capabilities/${r.capability.id}`}>
          {r.capability.shortName}
        </Link>
      ),
    },
    { key: 'level', header: copy.inScope, render: (r) => copy.levels[r.level] },
    {
      key: 'reasons',
      header: copy.reasons,
      render: (r) => (
        <details>
          <summary>{copy.why}</summary>
          <ul>
            {r.reasons.map((reason) => (
              <li className={styles.reason} key={reason.ruleId}>
                <p>{reason.because}</p>
                <Evidence {...reason} />
                {technical && (
                  <>
                    <p>
                      {copy.origin[reason.origin]} ·{' '}
                      <Link to={`/methodology#rule-${reason.ruleId}`}>
                        <code>{reason.ruleId}</code>
                      </Link>
                    </p>
                    <p>{describeCondition(reason.when, content.questions, copy.condition)}</p>
                    {reason.detail && <p>{reason.detail}</p>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      ),
    },
  ];
  if (technical)
    columns.push(
      {
        key: 'readiness',
        header: copy.readiness,
        render: (r) => copy.readinessStatuses[r.readiness.status],
      },
      { key: 'owner', header: content.site.capabilities.brief.owner, render: (r) => r.ownerTeam },
      { key: 'wave', header: content.site.capabilities.columns.wave, render: (r) => r.wave },
    );
  const riskList = (risks: AssessmentResult['risks']) =>
    risks.length === 0 ? (
      <p>{copy.noRisks}</p>
    ) : (
      <ul className={styles.cards}>
        {risks.map(({ risk, inScope, outOfScope }) => (
          <li className={styles.card} key={risk.id}>
            <h3>{risk.title}</h3>
            <p>{risk.summary}</p>
            <Evidence {...risk} />
            {technical && (
              <p>{describeCondition(risk.triggeredWhen, content.questions, copy.condition)}</p>
            )}
            <h4>{copy.mitigationsInScope}</h4>
            <CapabilityLinks ids={inScope} />
            <h4>{copy.mitigationsOutOfScope}</h4>
            <CapabilityLinks ids={outOfScope} />
          </li>
        ))}
      </ul>
    );
  return (
    <div className={styles.report}>
      <section id="in-scope">
        <h2>{copy.inScope}</h2>
        <DataTable
          caption={copy.inScope}
          hideCaption
          columns={columns}
          rows={result.inScope}
          rowKey={(r) => r.capability.id}
          scrollLabel={copy.inScope}
        />
      </section>
      <details>
        <summary>{copy.notInScope}</summary>
        <ul>
          {result.notInScope.map(({ capability, becomesRelevantIf }) => (
            <li key={capability.id}>
              <h3>
                <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
              </h3>
              <p>{copy.becomesRelevant}</p>
              {becomesRelevantIf.length === 0 ? (
                <p>{copy.noRule}</p>
              ) : (
                <ul>
                  {becomesRelevantIf.map((r) => (
                    <li key={r.ruleId}>
                      {describeCondition(r.when, content.questions, copy.condition)}
                      {technical && (
                        <>
                          {' '}
                          ·{' '}
                          <Link className={styles.cellLink} to={`/methodology#rule-${r.ruleId}`}>
                            <code>{r.ruleId}</code>
                          </Link>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </details>
      <section>
        <h2>{copy.risks}</h2>
        <p className={styles.note}>{copy.riskNote}</p>
        {riskList(result.risks)}
        {result.potentialRisks.length > 0 && (
          <details>
            <summary>{copy.potentialRisks}</summary>
            {riskList(result.potentialRisks)}
          </details>
        )}
      </section>
      <section>
        <h2>{copy.integration}</h2>
        {result.integrationPaths.length === 0 && <p>{copy.unknownAnswer}</p>}
        {result.integrationPaths.map((path) => (
          <article key={path.id}>
            <h3>{path.title}</h3>
            {path.status === 'verify' && <p>{copy.verify}</p>}
            <ul>
              {path.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Evidence {...path} />
          </article>
        ))}
      </section>
      <section>
        <h2>{copy.readiness}</h2>
        <p className={styles.note}>{copy.readinessNote}</p>
        <p>
          {copy.readinessPercent}:{' '}
          {result.readiness.percent === null ? copy.unknownAnswer : `${result.readiness.percent}%`}{' '}
          ({result.readiness.readyCount} / {result.readiness.total})
        </p>
        <ul>
          {result.readiness.checks.map((check) => (
            <li key={check.id}>
              <strong>{copy.readinessStatuses[check.status]}</strong> — {check.gap}
              {check.capabilityId && <CapabilityLinks ids={[check.capabilityId]} />}
              {technical && (
                <p>{describeCondition(check.when, content.questions, copy.condition)}</p>
              )}
              {check.sourceId && (
                <Evidence
                  sourceIds={[check.sourceId]}
                  evidence={check.evidence}
                  reviewStatus="draft"
                />
              )}
            </li>
          ))}
        </ul>
        {result.readiness.uncheckedCapabilities.length > 0 && (
          <details>
            <summary>{copy.noChecks}</summary>
            <CapabilityLinks ids={result.readiness.uncheckedCapabilities} />
          </details>
        )}
      </section>
      <section>
        <h2>{copy.licensing}</h2>
        <p>
          {copy.licensingCounts}: {result.licensing.foundational} / {result.licensing.premium}
        </p>
        <p>
          {copy.expectedUsers}: {result.licensing.expectedUsersLabel ?? copy.unknownAnswer}
        </p>
        <p>{result.licensing.basis ?? copy.unknownAnswer}</p>
        <p>{result.licensing.note}</p>
        <ul className={styles.links}>
          {result.licensing.sourceIds.map((id) => {
            const source = sourceById(id)!;
            return (
              <li key={id}>
                <ExternalLink href={source.url}>{source.title}</ExternalLink>
              </li>
            );
          })}
        </ul>
        {(result.gccGaps.length > 0 || result.sovereignVerification) && (
          <>
            <h3>{copy.gcc}</h3>
            <CapabilityLinks ids={result.gccGaps.map((r) => r.capability.id)} />
            {result.sovereignVerification && <p>{copy.sovereign}</p>}
          </>
        )}
      </section>
      <section>
        <h2>{copy.frontier}</h2>
        <p className={styles.note}>{copy.frontierNote}</p>
        {result.frontier.length === 0 && <p>{copy.unknownAnswer}</p>}
        {result.frontier.map((mapping) => (
          <article key={mapping.id}>
            <h3>{content.learn.frontier.find((p) => p.id === mapping.phaseId)!.title}</h3>
            <p>{mapping.rationale}</p>
            <Evidence {...mapping} />
          </article>
        ))}
      </section>
      {technical && (
        <>
          <section>
            <h2>{copy.anatomy}</h2>
            <DataTable
              caption={copy.anatomy}
              hideCaption
              scrollLabel={copy.anatomy}
              rows={result.anatomy}
              rowKey={(r) => r.point.id}
              columns={[
                {
                  key: 'layer',
                  header: content.site.capabilities.columns.layer,
                  rowHeader: true,
                  render: (r) => r.point.layer,
                },
                {
                  key: 'capabilities',
                  header: content.site.capabilities.columns.capability,
                  render: (r) => (
                    <CapabilityLinks ids={r.capabilities.map((c) => c.capability.id)} />
                  ),
                },
              ]}
            />
          </section>
          <section>
            <h2>{copy.operatingModel}</h2>
            <DataTable
              caption={copy.operatingModel}
              hideCaption
              scrollLabel={copy.operatingModel}
              rows={result.operatingModel}
              rowKey={(r) => r.ownerTeam}
              columns={[
                {
                  key: 'owner',
                  header: content.site.capabilities.brief.owner,
                  rowHeader: true,
                  render: (r) => r.ownerTeam,
                },
                ...content.lifecycle.map((stage) => ({
                  key: stage.id,
                  header: stage.label,
                  render: (r: AssessmentResult['operatingModel'][number]) => (
                    <CapabilityLinks
                      ids={r.stages
                        .find((s) => s.stage.id === stage.id)!
                        .capabilities.map((c) => c.capability.id)}
                    />
                  ),
                })),
              ]}
            />
            <h3>{copy.agentDecisions}</h3>
            <CapabilityLinks ids={result.agentDecisions.map((r) => r.capability.id)} />
          </section>
          <section>
            <h2>{copy.intensity}</h2>
            <p className={styles.note}>{copy.intensityNote}</p>
            <p>
              {copy.intensity}: {result.intensity.overall} / 100
            </p>
            <DataTable
              caption={copy.intensity}
              rows={result.intensity.pillars}
              rowKey={(r) => r.pillar.id}
              columns={[
                {
                  key: 'pillar',
                  header: content.site.capabilities.columns.pillar,
                  rowHeader: true,
                  render: (r) => r.pillar.label,
                },
                {
                  key: 'score',
                  header: copy.intensity,
                  numeric: true,
                  render: (r) => `${r.value} / 100`,
                },
              ]}
            />
          </section>
        </>
      )}
      <section>
        <h2>{copy.advisories}</h2>
        {result.advisories.map((a) => (
          <article key={a.id}>
            <h3>{a.title}</h3>
            <p>{a.body}</p>
            <Evidence {...a} />
          </article>
        ))}
      </section>
      <details>
        <summary>{copy.openQuestions}</summary>
        <ul>
          {result.openQuestions.map((q) => (
            <li key={q.id}>
              <strong>{q.label}</strong> — {q.guidance}
            </li>
          ))}
        </ul>
      </details>
      <p className={styles.note}>{copy.pendingDiagnostic}</p>
    </div>
  );
}
