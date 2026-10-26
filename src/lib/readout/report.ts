import type { Answers, Content } from '../content/schemas.ts';
import { computeReadoutMetrics } from '../content/metrics.ts';
import { renderTemplate } from '../content/template.ts';
import { knownAnswer } from '../engine/answers.ts';
import { evaluateAssessment } from '../engine/evaluate.ts';
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
  const summary = data.site.readout.takeaways.map((text, i) =>
    renderTemplate(text, { count: counts[i]! }),
  );
  const name = displayName(
    assessment.answers,
    'useCaseName',
    data.site.diagnostic.untitledAssessment,
  );
  return {
    name,
    title: renderTemplate(data.site.readout.title, { label: name }),
    organizationName: displayName(
      organization.answers,
      'orgName',
      data.site.diagnostic.untitledOrganization,
    ),
    answers: { ...organization.answers, ...assessment.answers },
    result,
    metrics,
    summary,
  };
}
export type Readout = ReturnType<typeof buildReadout>;

const markdownText = (text: string) =>
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
    '',
    `## ${text(copy.summary)}`,
    ...readout.summary.map((line) => `- ${text(line)}`),
    '',
    `## ${text(copy.anatomy)}`,
    ...readout.result.anatomy.map(
      ({ point, capabilities }) =>
        `- ${text(point.layer)}: ${text(capabilities.map((r) => r.capability.shortName).join(', ') || mapping.unknownAnswer)}`,
    ),
    '',
    `## ${text(copy.roadmap)}`,
    text(copy.roadmapNote),
  ];
  for (const wave of [1, 2, 3] as const) {
    lines.push('', `### ${text(copy.waves[wave])}`);
    const rows = readout.result.inScope.filter((r) => r.wave === wave);
    lines.push(
      ...rows.map((r) => `- ${text(r.capability.shortName)}: ${text(mapping.levels[r.level])}`),
    );
    if (rows.length === 0) lines.push(text(copy.empty));
  }
  lines.push('', `## ${text(mapping.inScope)}`);
  for (const row of readout.result.inScope) {
    lines.push('', `### ${text(row.capability.shortName)} — ${text(mapping.levels[row.level])}`);
    for (const reason of row.reasons)
      lines.push(
        `- ${text(reason.because)} (${text(mapping.origin[reason.origin])}; ${text(data.site.learn.evidence[reason.evidence])}; ${text(reason.ruleId)})`,
      );
  }
  lines.push('', `## ${text(mapping.risks)}`, text(mapping.riskNote));
  for (const { risk, inScope } of readout.result.risks)
    lines.push(
      `- ${text(risk.title)}: ${text(risk.summary)}`,
      `  - ${text(mapping.mitigationsInScope)}: ${text(inScope.map((id) => data.capabilities.find((c) => c.id === id)!.shortName).join(', ') || copy.empty)}`,
    );
  if (readout.result.risks.length === 0) lines.push(text(mapping.noRisks));
  lines.push('', `## ${text(mapping.readiness)}`, text(mapping.readinessNote));
  for (const check of readout.result.readiness.checks)
    lines.push(`- ${text(mapping.readinessStatuses[check.status])}: ${text(check.gap)}`);
  lines.push(
    '',
    `## ${text(mapping.licensing)}`,
    `${text(copy.foundational)}: ${readout.metrics.foundational}`,
    `${text(copy.premium)}: ${readout.metrics.premium}`,
    text(readout.result.licensing.basis ?? mapping.unknownAnswer),
    text(readout.result.licensing.note),
    '',
    `## ${text(copy.answers)}`,
  );
  for (const question of data.questions)
    lines.push(
      `- ${text(question.label)}: ${text(answerLabel(data, readout.answers, question.id))}`,
    );
  lines.push('', `## ${text(copy.sources)}`);
  for (const source of data.sources) lines.push(`- [${text(source.title)}](${source.url})`);
  lines.push('', text(data.site.disclaimer), '');
  return lines.join('\n');
}
