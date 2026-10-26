import { useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../components/DataTable.tsx';
import { ExhibitFrame } from '../../components/ExhibitFrame.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { content } from '../../lib/content/index.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { describeCondition } from '../../lib/engine/conditions.ts';
import { evaluateWhatIfs } from '../../lib/engine/evaluate.ts';
import { answerLabel, type Readout } from '../../lib/readout/report.ts';
import type { Assessment, Organization } from '../../lib/state/diagnostic-model.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { Evidence } from '../mapping/Evidence.tsx';
import { CapabilityLinks } from '../mapping/MappingReport.tsx';
import styles from './Readout.module.css';

export function ReadoutExhibits({
  report,
  assessment,
  organization,
}: {
  report: Readout;
  assessment: Assessment;
  organization: Organization;
}) {
  const { depth } = useDepth();
  const technical = depth === 'technical';
  const copy = content.site.readout;
  const mapping = content.site.mapping;
  const { result } = report;
  const tableLabel = (label: string) => renderTemplate(copy.tableLabel, { label });
  const [whatIf, setWhatIf] = useState('');
  const deltas = technical
    ? evaluateWhatIfs(
        content,
        { org: organization.answers, useCase: assessment.answers },
        result.contentVersion,
      )
    : [];
  const delta = deltas.find((item) => item.whatIf.id === whatIf);
  const frame = (key: keyof typeof copy.exhibits, number: number) => ({
    number,
    label: copy.exhibits[key],
    title: copy.exhibits[key],
    sourceIds: [
      ...new Set(
        key === 'frontier'
          ? result.frontier.flatMap((item) => item.sourceIds)
          : key === 'risks'
            ? [...result.risks, ...result.potentialRisks].flatMap(({ risk }) => risk.sourceIds)
            : key === 'integration'
              ? result.integrationPaths.flatMap((path) => path.sourceIds)
              : result.inScope.flatMap((r) => [
                  r.capability.source.sourceId,
                  ...r.reasons.flatMap((reason) => reason.sourceIds),
                ]),
      ),
    ],
  });
  const risks = (rows: typeof result.risks) =>
    rows.length === 0 ? (
      <p>{mapping.noRisks}</p>
    ) : (
      <ul>
        {rows.map(({ risk, inScope, outOfScope }) => (
          <li key={risk.id}>
            <h3>{risk.title}</h3>
            <p>{risk.summary}</p>
            <Evidence {...risk} />
            <h4>{mapping.mitigationsInScope}</h4>
            <CapabilityLinks ids={inScope} />
            <h4>{mapping.mitigationsOutOfScope}</h4>
            <CapabilityLinks ids={outOfScope} />
            {technical && (
              <p>{describeCondition(risk.triggeredWhen, content.questions, mapping.condition)}</p>
            )}
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <ExhibitFrame {...frame('frontier', 1)}>
        <p>{mapping.frontierNote}</p>
        {result.frontier.length === 0 && <p>{mapping.unknownAnswer}</p>}
        {result.frontier.map((item) => (
          <div key={item.id}>
            <h3>{content.learn.frontier.find((phase) => phase.id === item.phaseId)!.title}</h3>
            <p>{item.rationale}</p>
            <Evidence {...item} />
          </div>
        ))}
      </ExhibitFrame>
      <ExhibitFrame {...frame('anatomy', 2)}>
        <p>{copy.anatomyNote}</p>
        <div className={styles.anatomyDiagram} aria-hidden="true">
          {result.anatomy.map(({ point, capabilities }) => (
            <div key={point.id}>
              <strong>{point.layer}</strong>
              <p>
                {mapping.inScope}:{' '}
                {capabilities.map((r) => r.capability.shortName).join(', ') || copy.empty}
              </p>
              <p className={styles.outOfScope}>
                {mapping.notInScope}:{' '}
                {result.notInScope
                  .filter((r) => r.capability.controlPoints.includes(point.id))
                  .map((r) => r.capability.shortName)
                  .join(', ') || copy.empty}
              </p>
            </div>
          ))}
        </div>
        <DataTable
          caption={copy.anatomy}
          hideCaption
          scrollLabel={tableLabel(copy.anatomy)}
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
              key: 'scope',
              header: mapping.inScope,
              render: (r) => <CapabilityLinks ids={r.capabilities.map((c) => c.capability.id)} />,
            },
            {
              key: 'out',
              header: mapping.notInScope,
              render: (r) => (
                <div className={styles.outOfScope}>
                  <CapabilityLinks
                    ids={result.notInScope
                      .filter((c) => c.capability.controlPoints.includes(r.point.id))
                      .map((c) => c.capability.id)}
                  />
                </div>
              ),
            },
          ]}
        />
      </ExhibitFrame>
      <ExhibitFrame {...frame('risks', 3)}>
        <p>{mapping.riskNote}</p>
        {risks(result.risks)}
        {result.potentialRisks.length > 0 && (
          <details>
            <summary>{mapping.potentialRisks}</summary>
            {risks(result.potentialRisks)}
          </details>
        )}
      </ExhibitFrame>
      {technical && (
        <ExhibitFrame {...frame('capabilities', 4)}>
          <DataTable
            caption={copy.exhibits.capabilities}
            hideCaption
            scrollLabel={tableLabel(copy.exhibits.capabilities)}
            rows={result.inScope}
            rowKey={(r) => r.capability.id}
            columns={[
              {
                key: 'capability',
                header: content.site.capabilities.columns.capability,
                rowHeader: true,
                render: (r) => (
                  <Link to={`/capabilities/${r.capability.id}`}>{r.capability.shortName}</Link>
                ),
              },
              { key: 'level', header: mapping.inScope, render: (r) => mapping.levels[r.level] },
              {
                key: 'why',
                header: mapping.reasons,
                render: (r) => (
                  <ul>
                    {r.reasons.map((reason) => (
                      <li key={reason.ruleId}>
                        <p>{reason.because}</p>
                        <p>
                          {mapping.origin[reason.origin]} ·{' '}
                          <Link to={`/methodology#rule-${reason.ruleId}`}>
                            <code>{reason.ruleId}</code>
                          </Link>
                        </p>
                        <p>
                          {describeCondition(reason.when, content.questions, mapping.condition)}
                        </p>
                        {reason.detail && <p>{reason.detail}</p>}
                        <Evidence {...reason} />
                      </li>
                    ))}
                  </ul>
                ),
              },
              {
                key: 'tier',
                header: content.site.capabilities.columns.licensing,
                render: (r) => content.site.ui.badges[licensingTier(r.capability)],
              },
              {
                key: 'gcc',
                header: content.site.capabilities.columns.gcc,
                render: (r) =>
                  r.capability.source.gccAvailable
                    ? content.site.ui.badges.gccAvailable
                    : content.site.ui.badges.gccUnavailable,
              },
              {
                key: 'sources',
                header: content.site.capabilities.brief.sourceNotes,
                render: (r) => (
                  <>
                    <Evidence
                      sourceIds={[r.capability.source.sourceId]}
                      evidence="stated"
                      reviewStatus={r.capability.reviewStatus}
                    />
                    {r.capability.sourceNotes?.map((note) => (
                      <p key={note.sourceId}>
                        {note.differs && (
                          <strong>{content.site.capabilities.sourcesDifferNote} </strong>
                        )}
                        {note.note}
                        <Evidence
                          sourceIds={[note.sourceId]}
                          evidence="stated"
                          reviewStatus={r.capability.reviewStatus}
                        />
                      </p>
                    ))}
                  </>
                ),
              },
            ]}
          />
        </ExhibitFrame>
      )}
      <ExhibitFrame {...frame('decisions', 5)}>
        <p>{copy.setupNote}</p>
        <div className={styles.roadmap}>
          <div>
            <h3>{copy.platform}</h3>
            <ul>
              {result.inScope
                .filter((r) => r.capability.setup !== 'agent')
                .map((r) => (
                  <li key={r.capability.id}>
                    <Link to={`/capabilities/${r.capability.id}`}>{r.capability.shortName}</Link> —{' '}
                    {r.ownerTeam}
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h3>{mapping.agentDecisions}</h3>
            <dl>
              {['accountableOwner', 'sponsor'].map((id) => (
                <div key={id}>
                  <dt>{content.questions.find((q) => q.id === id)!.label}</dt>
                  <dd>{answerLabel(content, report.answers, id)}</dd>
                </div>
              ))}
            </dl>
            <CapabilityLinks ids={result.agentDecisions.map((r) => r.capability.id)} />
          </div>
        </div>
      </ExhibitFrame>
      {technical && (
        <>
          <ExhibitFrame {...frame('readiness', 6)}>
            <p>{mapping.readinessNote}</p>
            <p>
              {mapping.readinessPercent}:{' '}
              {report.metrics.readinessPercent === null
                ? mapping.unknownAnswer
                : `${report.metrics.readinessPercent}%`}{' '}
              ({result.readiness.readyCount} / {result.readiness.total})
            </p>
            <ul>
              {result.readiness.checks.map((check) => (
                <li key={check.id}>
                  <strong>{mapping.readinessStatuses[check.status]}</strong> — {check.gap}
                  {check.capabilityId && <CapabilityLinks ids={[check.capabilityId]} />}
                  <p>{describeCondition(check.when, content.questions, mapping.condition)}</p>
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
            <p>{mapping.noChecks}</p>
            <CapabilityLinks ids={result.readiness.uncheckedCapabilities} />
          </ExhibitFrame>
          <ExhibitFrame {...frame('operatingModel', 7)}>
            <DataTable
              caption={mapping.operatingModel}
              hideCaption
              scrollLabel={tableLabel(mapping.operatingModel)}
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
                  render: (r: (typeof result.operatingModel)[number]) => (
                    <CapabilityLinks
                      ids={r.stages
                        .find((s) => s.stage.id === stage.id)!
                        .capabilities.map((c) => c.capability.id)}
                    />
                  ),
                })),
              ]}
            />
          </ExhibitFrame>
          <ExhibitFrame {...frame('integration', 8)}>
            {result.integrationPaths.length === 0 && <p>{mapping.unknownAnswer}</p>}
            {result.integrationPaths.map((path) => (
              <div key={path.id}>
                <h3>{path.title}</h3>
                {path.status === 'verify' && <p>{mapping.verify}</p>}
                <ul>
                  {path.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Evidence {...path} />
              </div>
            ))}
          </ExhibitFrame>
        </>
      )}
      <ExhibitFrame {...frame('licensing', 9)} sourceIds={result.licensing.sourceIds}>
        <p>
          {mapping.expectedUsers}: {result.licensing.expectedUsersLabel ?? mapping.unknownAnswer}
        </p>
        <p>{result.licensing.basis ?? mapping.unknownAnswer}</p>
        <p>{result.licensing.note}</p>
        <p>
          <strong>{copy.eligibility}</strong>
        </p>
        <p>
          {copy.foundational}: {report.metrics.foundational} · {copy.premium}:{' '}
          {report.metrics.premium}
        </p>
        {result.inScope
          .filter((r) => r.capability.sourceNotes?.some((n) => n.differs))
          .map((r) => (
            <div key={r.capability.id}>
              <h3>{r.capability.shortName}</h3>
              {r.capability.sourceNotes
                ?.filter((note) => note.differs)
                .map((note) => (
                  <div key={note.sourceId}>
                    <p>
                      <strong>{content.site.capabilities.sourcesDifferNote}</strong> {note.note}
                    </p>
                    <Evidence
                      sourceIds={[note.sourceId]}
                      evidence="stated"
                      reviewStatus={r.capability.reviewStatus}
                    />
                  </div>
                ))}
            </div>
          ))}
        {(result.gccGaps.length > 0 || result.sovereignVerification) && (
          <>
            <h3>{mapping.gcc}</h3>
            <CapabilityLinks ids={result.gccGaps.map((r) => r.capability.id)} />
            {result.sovereignVerification && <p>{mapping.sovereign}</p>}
          </>
        )}
      </ExhibitFrame>
      <ExhibitFrame {...frame('roadmap', 10)}>
        <p>{copy.roadmapNote}</p>
        <div className={styles.roadmap}>
          {([1, 2, 3] as const).map((wave) => {
            const rows = result.inScope.filter((r) => r.wave === wave);
            return (
              <div key={wave}>
                <h3>{copy.waves[wave]}</h3>
                {rows.length === 0 ? (
                  <p>{copy.empty}</p>
                ) : (
                  <ul>
                    {rows.map((r) => (
                      <li key={r.capability.id}>
                        <Link to={`/capabilities/${r.capability.id}`}>
                          {r.capability.shortName}
                        </Link>{' '}
                        — {mapping.levels[r.level]} · {r.ownerTeam}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </ExhibitFrame>
      {technical && (
        <>
          <ExhibitFrame {...frame('whatIfs', 11)}>
            <p>{copy.whatIfNote}</p>
            <label htmlFor="readout-what-if">{mapping.whatIfs}</label>
            <select id="readout-what-if" value={whatIf} onChange={(e) => setWhatIf(e.target.value)}>
              <option value="">{copy.baseline}</option>
              {deltas.map((d) => (
                <option key={d.whatIf.id} value={d.whatIf.id}>
                  {d.whatIf.title}
                </option>
              ))}
            </select>
            {delta && (
              <div role="status">
                <h3>{delta.whatIf.title}</h3>
                <p>
                  {mapping.added}:{' '}
                  {delta.added.map((r) => r.capability.shortName).join(', ') || copy.empty}
                </p>
                <p>
                  {mapping.removed}:{' '}
                  {delta.removed.map((r) => r.capability.shortName).join(', ') || copy.empty}
                </p>
                <ul>
                  {delta.changed.map((c) => (
                    <li key={c.capability.id}>
                      {c.capability.shortName}: {mapping.levels[c.from]} → {mapping.levels[c.to]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ExhibitFrame>
          <section>
            <h2>{copy.appendix}</h2>
            <h3>{mapping.notInScope}</h3>
            <ul>
              {result.notInScope.map(({ capability, becomesRelevantIf }) => (
                <li key={capability.id}>
                  <h4>
                    <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
                  </h4>
                  <p>{mapping.becomesRelevant}</p>
                  {becomesRelevantIf.length === 0 ? (
                    <p>{mapping.noRule}</p>
                  ) : (
                    <ul>
                      {becomesRelevantIf.map((r) => (
                        <li key={r.ruleId}>
                          {describeCondition(r.when, content.questions, mapping.condition)} ·{' '}
                          <Link to={`/methodology#rule-${r.ruleId}`}>
                            <code>{r.ruleId}</code>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <h3>{mapping.openQuestions}</h3>
            <ul>
              {result.openQuestions.map((q) => (
                <li key={q.id}>
                  <strong>{q.label}</strong> — {q.guidance}
                </li>
              ))}
            </ul>
            <h3>{copy.discovery}</h3>
            <ul>
              {result.inScope.flatMap((r) =>
                (r.capability.discoveryQuestions ?? []).map((question, i) => (
                  <li key={`${r.capability.id}-${i}`}>
                    {r.capability.shortName}: {question}
                  </li>
                )),
              )}
            </ul>
            <h3>{mapping.advisories}</h3>
            {result.advisories.map((a) => (
              <div key={a.id}>
                <h4>{a.title}</h4>
                <p>{a.body}</p>
                <Evidence {...a} />
              </div>
            ))}
            <h3>{mapping.intensity}</h3>
            <p>{mapping.intensityNote}</p>
            <p>{result.intensity.overall} / 100</p>
            <DataTable
              caption={mapping.intensity}
              hideCaption
              scrollLabel={mapping.intensity}
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
                  header: mapping.intensity,
                  numeric: true,
                  render: (r) => `${r.value} / 100`,
                },
              ]}
            />
            <h3>{copy.answers}</h3>
            <dl>
              {content.questions.map((q) => (
                <div key={q.id}>
                  <dt>{q.label}</dt>
                  <dd>{answerLabel(content, report.answers, q.id)}</dd>
                </div>
              ))}
            </dl>
            <h3>{copy.sources}</h3>
            <p>{copy.methodologyNote}</p>
            <Link to="/methodology">{content.site.ui.nav.methodology}</Link>
            <ul>
              {content.sources.map((source) => (
                <li key={source.id}>
                  <ExternalLink href={source.url}>{source.title}</ExternalLink>
                  {source.lastVerified && (
                    <>
                      {' '}
                      · {content.site.learn.verified}:{' '}
                      <time dateTime={source.lastVerified}>{source.lastVerified}</time>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
