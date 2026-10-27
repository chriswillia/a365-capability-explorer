import type { Answers, Content } from '../content/schemas.ts';
import { computeReadoutMetrics } from '../content/metrics.ts';
import { renderTemplate } from '../content/template.ts';
import { knownAnswer } from '../engine/answers.ts';
import { evaluateAssessment, evaluateWhatIfs } from '../engine/evaluate.ts';
import { describeCondition } from '../engine/conditions.ts';
import { pillarLabel, peopleRows, pillarRows, questionPillars } from '../engine/pillars.ts';
import { licensingTier } from '../content/derive.ts';
import { standingAssumptions } from '../state/assumptions.ts';
import { displayName, type Assessment, type Organization } from '../state/diagnostic-model.ts';

export function answerLabel(data: Content, answers: Answers, id: string): string {
  const question = data.questions.find((q) => q.id === id);
  if (!question) throw new Error(`Unknown readout question "${id}"`);
  const value = answers[id];
  if (!knownAnswer(value)) return data.site.mapping.unknownAnswer;
  return (Array.isArray(value) ? value : [value])
    .map((v) => question.options.find((o) => o.value === v)?.label ?? v)
    .join(', ');
}

/** The answer as a reader should see it: an answer the customer has not confirmed says so. */
export function answerText(
  data: Content,
  report: Pick<Readout, 'answers' | 'assumed'>,
  id: string,
) {
  const label = answerLabel(data, report.answers, id);
  return report.assumed.includes(id) ? `${label} (${data.site.readout.assumedMark})` : label;
}

export function buildReadout(
  data: Content,
  organization: Organization,
  assessment: Assessment,
  version: string,
) {
  const result = evaluateAssessment(
    data,
    { org: organization.answers, useCase: assessment.answers },
    version,
  );
  const metrics = computeReadoutMetrics(result);
  const counts = [metrics.capabilityCount, metrics.unresolved, metrics.unanswered];
  const assumed = standingAssumptions(assessment);
  const summary = [
    ...data.site.readout.takeaways.map((text, i) => renderTemplate(text, { count: counts[i]! })),
    ...(assumed.length > 0
      ? [renderTemplate(data.site.readout.assumedTakeaway, { count: assumed.length })]
      : []),
  ];
  const name = displayName(
    assessment.answers,
    'useCaseName',
    data.site.diagnostic.untitledAssessment,
  );
  const organizationName = displayName(
    organization.answers,
    'orgName',
    data.site.diagnostic.untitledOrganization,
  );
  return {
    name,
    title: renderTemplate(data.site.readout.title, { label: name, organization: organizationName }),
    organizationName,
    answers: { ...organization.answers, ...assessment.answers },
    assumed,
    result,
    metrics,
    pillars: pillarRows(data, result.inScope),
    summary,
    logo: assessment.logo,
  };
}
export type Readout = ReturnType<typeof buildReadout>;

export function summarizeText(value: string, limit: number): string {
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Invalid summary character limit');
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join('');
}

export function canvasFields(data: Content, report?: Readout) {
  return data.site.readout.canvasBoxes.map((box) => {
    const answers = report
      ? box.questionIds.map(
          (id) =>
            `${data.questions.find((q) => q.id === id)!.label}: ${answerText(data, report, id)}`,
        )
      : [];
    if (report && box.id === 'risks')
      answers.push(...report.result.risks.map(({ risk }) => risk.title));
    return { ...box, body: answers.length ? answers.join('\n') : box.prompt };
  });
}

export const markdownText = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()#!|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');

export function readoutMarkdown(data: Content, readout: Readout): string {
  const copy = data.site.readout;
  const mapping = data.site.mapping;
  const text = markdownText;
  const lines = [
    `# ${text(readout.title)}`,
    '',
    text(copy.draft),
    text(copy.current),
    '',
    `${text(copy.preparedFor)}: ${text(readout.organizationName)}`,
    `${text(data.site.diagnostic.currentContent)}: ${text(readout.result.contentVersion)}`,
    ...['engagementName', 'preparedBy', 'preparedOn'].map(
      (id) =>
        `${text(data.questions.find((q) => q.id === id)!.label)}: ${text(answerLabel(data, readout.answers, id))}`,
    ),
    '',
    `## ${text(copy.summary)}`,
    ...readout.summary.map((line) => `- ${text(line)}`),
  ];
  const result = readout.result;
  const condition = (when: Parameters<typeof describeCondition>[0]) =>
    text(describeCondition(when, data.questions, mapping.condition));
  const names = (ids: string[]) =>
    text(
      ids.map((id) => data.capabilities.find((c) => c.id === id)!.shortName).join(', ') ||
        copy.empty,
    );
  const evidence = (item: {
    sourceIds: string[];
    evidence: keyof typeof data.site.learn.evidence;
    reviewStatus: string;
  }) =>
    `${text(data.site.learn.evidence[item.evidence])}; ${text(item.reviewStatus)}; ${item.sourceIds.join(', ')}`;
  const heading = (key: keyof typeof copy.exhibits) =>
    lines.push(
      '',
      `## ${text(renderTemplate(data.site.ui.exhibit.eyebrow, { number: (exhibitNumber += 1), label: copy.exhibits[key] }))}`,
    );
  let exhibitNumber = 0;
  lines.push(
    '',
    ...(['essential', 'recommended', 'consider'] as const).map(
      (level) => `- ${mapping.levels[level]}: ${readout.metrics.levels[level]}`,
    ),
    `${text(copy.platform)}: ${readout.metrics.platform}`,
    `${text(copy.agent)}: ${readout.metrics.agent}`,
    `${text(copy.foundational)}: ${readout.metrics.foundational}`,
    `${text(copy.premium)}: ${readout.metrics.premium}`,
    `${text(mapping.readinessPercent)}: ${readout.metrics.readinessPercent === null ? text(mapping.unknownAnswer) : `${readout.metrics.readinessPercent}%`}`,
    '',
  );
  heading('pillars');
  lines.push(text(mapping.pillarsNote));
  for (const row of readout.pillars) {
    lines.push(
      `### ${text(pillarLabel(data, row.pillar))}`,
      `${text(renderTemplate(mapping.pillarCount, { count: row.items.length, total: row.catalogTotal }))}; ${text(
        (['essential', 'recommended', 'consider'] as const)
          .map((level) => `${mapping.levels[level]} ${row.levels[level]}`)
          .join(', '),
      )}`,
      ...(row.items.length === 0
        ? [text(mapping.pillarNone)]
        : [
            text(
              renderTemplate(mapping.pillarFlags, { premium: row.premium, notInGcc: row.notInGcc }),
            ),
            ...row.items.map(
              ({ capability, level, ownerTeam }) =>
                `- ${text(capability.shortName)} — ${text(mapping.levels[level])}; ${text(ownerTeam)}`,
            ),
          ]),
    );
  }
  heading('anatomy');
  lines.push(text(copy.anatomyNote));
  for (const { point, capabilities } of result.anatomy)
    lines.push(
      `- ${text(point.layer)} — ${text(mapping.inScope)}: ${names(capabilities.map((r) => r.capability.id))}`,
      `  - ${text(mapping.notInScope)}: ${names(result.notInScope.filter((r) => r.capability.controlPoints.includes(point.id)).map((r) => r.capability.id))}`,
    );
  heading('risks');
  lines.push(text(mapping.riskNote));
  for (const [label, rows] of [
    [mapping.risks, result.risks],
    [mapping.potentialRisks, result.potentialRisks],
  ] as const) {
    lines.push(`### ${text(label)}`);
    for (const { risk, inScope, outOfScope } of rows)
      lines.push(
        `- ${text(risk.title)}: ${text(risk.summary)} (${evidence(risk)})`,
        `  - ${condition(risk.triggeredWhen)}`,
        `  - ${text(mapping.mitigationsInScope)}: ${names(inScope)}`,
        `  - ${text(mapping.mitigationsOutOfScope)}: ${names(outOfScope)}`,
      );
    if (rows.length === 0) lines.push(text(mapping.noRisks));
  }
  heading('capabilities');
  for (const row of result.inScope) {
    lines.push('', `### ${text(row.capability.shortName)} — ${text(mapping.levels[row.level])}`);
    for (const reason of row.reasons)
      lines.push(
        `- ${text(reason.because)} (${text(mapping.origin[reason.origin])}; ${text(reason.ruleId)}; ${evidence(reason)})`,
        `  - ${condition(reason.when)}${reason.detail ? `; ${text(reason.detail)}` : ''}`,
      );
    lines.push(
      `${text(data.site.capabilities.columns.licensing)}: ${text(data.site.ui.badges[licensingTier(row.capability)])}; ${text(data.site.capabilities.columns.gcc)}: ${text(row.capability.source.gccAvailable ? data.site.ui.badges.gccAvailable : data.site.ui.badges.gccUnavailable)}`,
      `${text(data.site.ui.setup[row.capability.setup])}; ${text(row.ownerTeam)}; ${text(mapping.readinessStatuses[row.readiness.status])}; ${row.wave}; ${row.capability.source.sourceId}`,
    );
    for (const note of row.capability.sourceNotes ?? [])
      lines.push(
        `- ${note.differs ? text(data.site.capabilities.sourcesDifferNote) : ''} ${text(note.note)} (${note.sourceId})`,
      );
  }
  heading('decisions');
  lines.push(
    text(copy.setupNote),
    `${text(copy.platform)}: ${names(result.inScope.filter((r) => r.capability.setup !== 'agent').map((r) => r.capability.id))}`,
    `${text(mapping.agentDecisions)}: ${names(result.agentDecisions.map((r) => r.capability.id))}`,
    `${text(data.questions.find((q) => q.id === 'accountableOwner')!.label)}: ${text(answerLabel(data, readout.answers, 'accountableOwner'))}`,
    `${text(data.questions.find((q) => q.id === 'sponsor')!.label)}: ${text(answerLabel(data, readout.answers, 'sponsor'))}`,
  );
  heading('people');
  lines.push(text(copy.peopleNote));
  for (const { team, areas, capabilities } of peopleRows(data, result.inScope))
    lines.push(
      `- ${text(team)} — ${text(areas.join(', '))}: ${names(capabilities.map((c) => c.id))}`,
    );
  heading('readiness');
  lines.push(text(mapping.readinessNote));
  for (const check of result.readiness.checks)
    lines.push(
      `- ${text(mapping.readinessStatuses[check.status])}: ${text(check.gap)}; ${condition(check.when)}; ${check.capabilityId ? names([check.capabilityId]) : ''}; ${check.sourceId ?? ''}; ${text(data.site.learn.evidence[check.evidence])}`,
    );
  lines.push(text(mapping.noChecks), names(result.readiness.uncheckedCapabilities));
  heading('operatingModel');
  for (const row of result.operatingModel) {
    lines.push(`### ${text(row.ownerTeam)}`);
    for (const stage of row.stages)
      lines.push(
        `- ${text(stage.stage.label)}: ${names(stage.capabilities.map((c) => c.capability.id))}`,
      );
  }
  heading('integration');
  for (const path of result.integrationPaths)
    lines.push(
      `### ${text(path.title)}`,
      text(path.status === 'verify' ? mapping.verify : copy.draft),
      ...path.checklist.map((item) => `- ${text(item)}`),
      evidence(path),
    );
  if (result.integrationPaths.length === 0) lines.push(text(mapping.unknownAnswer));
  heading('licensing');
  lines.push(
    text(copy.eligibility),
    `${text(mapping.expectedUsers)}: ${text(result.licensing.expectedUsersLabel ?? mapping.unknownAnswer)}`,
    text(result.licensing.basis ?? mapping.unknownAnswer),
    text(result.licensing.note),
    `${text(mapping.gcc)}: ${names(result.gccGaps.map((r) => r.capability.id))}`,
  );
  if (result.sovereignVerification) lines.push(text(mapping.sovereign));
  heading('openQuestions');
  lines.push(text(copy.openQuestionsNote));
  const informs = questionPillars(data);
  for (const q of result.openQuestions) {
    const affects = data.pillars
      .filter((p) => informs.get(q.id)?.has(p.id))
      .map((p) => p.requirement);
    lines.push(
      `- ${text(q.label)}${affects.length > 0 ? ` (${text(renderTemplate(mapping.informs, { label: affects.join(', ') }))})` : ''}: ${text(q.guidance)}`,
    );
  }
  lines.push(...result.unknownRuleIds.map((id) => `- ${text(mapping.unknownAnswer)}: ${id}`));
  heading('roadmap');
  lines.push(text(copy.roadmapNote));
  for (const wave of [1, 2, 3] as const)
    lines.push(
      `### ${text(copy.waves[wave])}`,
      ...result.inScope
        .filter((r) => r.wave === wave)
        .map(
          (r) =>
            `- ${text(r.capability.shortName)}: ${text(mapping.levels[r.level])}; ${text(r.ownerTeam)}`,
        ),
    );
  heading('frontier');
  lines.push(text(mapping.frontierNote));
  for (const item of result.frontier)
    lines.push(
      `- ${text(data.learn.frontier.find((p) => p.id === item.phaseId)!.title)}: ${text(item.rationale)} (${evidence(item)})`,
    );
  if (result.frontier.length === 0) lines.push(text(mapping.unknownAnswer));
  heading('whatIfs');
  lines.push(text(copy.whatIfNote));
  const org = Object.fromEntries(
    data.questions
      .filter((q) => q.scope === 'org')
      .map((q) => [q.id, readout.answers[q.id] ?? null]),
  );
  const useCase = Object.fromEntries(
    data.questions
      .filter((q) => q.scope === 'useCase')
      .map((q) => [q.id, readout.answers[q.id] ?? null]),
  );
  for (const delta of evaluateWhatIfs(data, { org, useCase }, result.contentVersion))
    lines.push(
      `### ${text(delta.whatIf.title)}`,
      `${text(mapping.added)}: ${names(delta.added.map((r) => r.capability.id))}`,
      `${text(mapping.removed)}: ${names(delta.removed.map((r) => r.capability.id))}`,
      ...delta.changed.map(
        (c) =>
          `- ${text(c.capability.shortName)}: ${mapping.levels[c.from]} → ${mapping.levels[c.to]}`,
      ),
    );
  lines.push('', `## ${text(copy.appendix)}`, `### ${text(mapping.notInScope)}`);
  for (const { capability, becomesRelevantIf } of result.notInScope)
    lines.push(
      `- ${text(capability.shortName)} — ${text(mapping.becomesRelevant)}: ${becomesRelevantIf.map((r) => `${condition(r.when)} (${r.ruleId})`).join('; ') || text(mapping.noRule)}`,
    );
  lines.push(`### ${text(copy.discovery)}`);
  for (const row of result.inScope)
    lines.push(
      ...(row.capability.discoveryQuestions ?? []).map(
        (q) => `- ${text(row.capability.shortName)}: ${text(q)}`,
      ),
    );
  lines.push(`### ${text(mapping.advisories)}`);
  for (const advisory of result.advisories)
    lines.push(`- ${text(advisory.title)}: ${text(advisory.body)} (${evidence(advisory)})`);
  lines.push(
    `### ${text(mapping.intensity)}`,
    text(mapping.intensityNote),
    `${result.intensity.overall} / 100`,
    ...result.intensity.pillars.map((p) => `- ${text(p.pillar.label)}: ${p.value} / 100`),
    `### ${text(copy.answers)}`,
  );
  for (const question of data.questions)
    lines.push(`- ${text(question.label)}: ${text(answerText(data, readout, question.id))}`);
  lines.push('', `## ${text(copy.sources)}`);
  lines.push(text(copy.methodologyNote), text(copy.verifyNext));
  for (const source of data.sources)
    lines.push(
      `- [${text(source.title)}](${source.url})${source.lastVerified ? ` — ${text(data.site.learn.verified)}: ${source.lastVerified}` : ''}`,
    );
  lines.push('', text(data.site.disclaimer), '');
  return lines.join('\n');
}
