import type { Content } from '../content/schemas.ts';
import { renderTemplate } from '../content/template.ts';
import { describeGcc } from '../engine/gcc.ts';
import { byUrgency } from '../engine/guardrails.ts';
import { pillarLabel } from '../engine/pillars.ts';
import { describeReadiness } from '../engine/readiness.ts';
import { answerLabel, type Readout } from './report.ts';

/**
 * The speaker notes for the eight readout slides, keyed by slide: what to say, then the full detail that
 * the slide has to shorten. Each slide carries only its own detail, not the whole readout.
 */
export function readoutSlideNotes(data: Content, report: Readout) {
  const copy = data.site.readout;
  const mapping = data.site.mapping;
  const { result, metrics } = report;
  const question = (id: string) => data.questions.find((q) => q.id === id)!.label;
  const answer = (id: string) => `${question(id)}: ${answerLabel(data, report.answers, id)}`;
  const capabilityNames = (ids: string[]) =>
    ids.map((id) => data.capabilities.find((c) => c.id === id)?.shortName ?? id);
  const note = (talk: string, detail: string[]) =>
    [talk, '', `${copy.slideNotesDetail}:`, ...detail].join('\n');
  const bullet = (value: string) => `- ${value}`;

  const title = note(copy.slideNotes.title, [
    `${copy.preparedFor}: ${report.organizationName}`,
    answer('preparedBy'),
    answer('preparedOn'),
    answer('engagementName'),
    answer('businessOutcome'),
    answer('accountableOwner'),
    answer('successMeasures'),
    `${copy.draft} · ${result.contentVersion}`,
  ]);

  const pillars = note(
    copy.slideNotes.pillars,
    report.pillars.flatMap((row) => [
      `${pillarLabel(data, row.pillar)}: ${renderTemplate(mapping.pillarCount, {
        count: row.items.length,
        total: row.catalogTotal,
      })}`,
      ...(row.items.length === 0
        ? [mapping.pillarNone]
        : row.items.map(({ capability, level }) =>
            bullet(`${capability.shortName} (${mapping.levels[level]})`),
          )),
    ]),
  );

  const summary = note(copy.slideNotes.summary, [
    ...report.summary,
    (['essential', 'recommended', 'consider'] as const)
      .map((level) => `${mapping.levels[level]}: ${metrics.levels[level]}`)
      .join(' · '),
    `${copy.foundational}: ${metrics.foundational} · ${copy.premium}: ${metrics.premium}`,
    `${copy.platform}: ${metrics.platform} · ${copy.both}: ${metrics.both} · ${copy.agent}: ${metrics.agent}`,
    `${mapping.readinessLabel}: ${describeReadiness(metrics.readiness, mapping)}`,
  ]);

  const anatomy = note(
    copy.slideNotes.anatomy,
    result.anatomy.map(
      ({ point, capabilities }) =>
        `${point.layer}: ${capabilities.map((r) => r.capability.shortName).join('; ') || mapping.unknownAnswer}`,
    ),
  );

  const risks = note(copy.slideNotes.riskControls, [
    ...(result.risks.length === 0
      ? [mapping.noRisks]
      : result.risks.map(
          ({ risk, inScope }) =>
            `${risk.title}: ${risk.summary} ${copy.riskControls}: ${capabilityNames(inScope).join('; ') || copy.empty}`,
        )),
    ...(result.potentialRisks.length === 0
      ? []
      : [
          `${mapping.potentialRisks}: ${result.potentialRisks.map(({ risk }) => risk.title).join('; ')}`,
        ]),
  ]);

  const guardrails = note(copy.slideNotes.guardrails, [
    renderTemplate(data.guardrails.summary, report.guardrails.counts),
    ...report.guardrails.gates.flatMap(({ gate, items }) => [
      `${gate.title}: ${gate.summary}`,
      ...(items.length === 0
        ? [copy.empty]
        : byUrgency(items).map(({ item, status }) =>
            bullet(
              `${data.guardrails.statusLabels[status]}: ${item.title}. ${item.why} ${data.guardrails.actionLabel}: ${item.action}`,
            ),
          )),
    ]),
  ]);

  const roadmap = note(
    copy.slideNotes.roadmap,
    ([1, 2, 3] as const).flatMap((wave) => {
      const rows = result.inScope.filter((r) => r.wave === wave);
      return [
        copy.waves[wave],
        ...(rows.length === 0
          ? [copy.empty]
          : rows.map((r) =>
              bullet(`${r.capability.shortName} (${mapping.levels[r.level]}): ${r.ownerTeam}`),
            )),
      ];
    }),
  );

  const licensing = note(copy.slideNotes.licensing, [
    result.licensing.basis ?? mapping.licenseBasisConfirm,
    `${mapping.expectedUsers}: ${result.licensing.expectedUsersLabel ?? mapping.unknownAnswer}`,
    result.licensing.note,
    `${mapping.gcc}: ${describeGcc(result, mapping)}`,
    copy.eligibility,
    `${copy.licenseWho}:`,
    ...report.license.populations.map(
      ({ population }) =>
        `- ${population.label} (${data.licensing.needs[population.need]}): ${population.statement}${population.confirm === undefined ? '' : ` ${population.confirm}`}`,
    ),
    `${copy.licenseNeeds}:`,
    ...report.license.requirements.map(
      ({ item, status }) =>
        `- ${data.licensing.requirementsPanel.kinds[item.kind]}: ${item.text} — ${data.licensing.requirementsPanel.status[status]}${
          status === 'unknown' && item.askPrompt !== undefined
            ? ` ${data.licensing.requirementsPanel.askLabel}: ${item.askPrompt}`
            : ''
        }`,
    ),
    ...(result.openQuestions.length === 0
      ? []
      : [
          `${copy.exhibits.openQuestions}:`,
          ...result.openQuestions.map(({ label, guidance }) => bullet(`${label}: ${guidance}`)),
        ]),
    copy.verifyNext,
    ...result.licensing.sourceIds.flatMap((id) => {
      const source = data.sources.find((s) => s.id === id);
      return source === undefined ? [] : [`${source.title}: ${source.url}`];
    }),
  ]);

  return { title, pillars, summary, anatomy, riskControls: risks, guardrails, roadmap, licensing };
}

export type SlideNotes = ReturnType<typeof readoutSlideNotes>;
