import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { evaluateWhatIfs, patternAnswers } from '../engine/evaluate.ts';
import { peopleRows, pillarLabel, questionPillars } from '../engine/pillars.ts';
import type { Assessment, Organization } from '../state/diagnostic-model.ts';
import {
  answerLabel,
  answerText,
  buildReadout,
  canvasFields,
  markdownText as escapeMarkdown,
  readoutMarkdown,
  summarizeText,
} from './report.ts';
import { exhibitPlan } from './plan.ts';
import { renderTemplate } from '../content/template.ts';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function entities() {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: 'old-version',
  };
  const organization: Organization = {
    ...entity,
    id: crypto.randomUUID(),
    answers: { ...input.org, orgName: 'Fictional organization' },
  };
  const assessment: Assessment = {
    ...entity,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: { ...input.useCase, useCaseName: 'Fictional readout' },
    mode: 'full',
    sectionId: 'review',
    patternId: 'process-agent',
    sampleId: 'askhr',
  };
  return { organization, assessment };
}

describe('saved assessment readouts', () => {
  it('preserves full canvas text and marks bounded Unicode-safe print summaries', () => {
    const { organization, assessment } = entities();
    assessment.answers.businessOutcome = 'A detailed outcome. '.repeat(100);
    assessment.answers.successMeasures = 'Baseline, target and review date';
    assessment.answers.accountableOwner = 'Fictional team';
    const report = buildReadout(content, organization, assessment, 'current');
    const boxes = canvasFields(content, report);
    expect(boxes).toHaveLength(10);
    expect(boxes.find((box) => box.id === 'outcome')!.body).toContain(
      String(assessment.answers.businessOutcome),
    );
    expect(boxes.find((box) => box.id === 'success')!.body).toContain('Baseline, target');
    expect(boxes.find((box) => box.id === 'ownership')!.body).toContain('Fictional team');
    expect(summarizeText('abcdef', 4)).toBe('abc…');
    expect(summarizeText('a😀bc', 3)).toBe('a😀…');
    expect(summarizeText('  first\nsecond  ', 100)).toBe('first second');
    expect(() => summarizeText('text', 0)).toThrow(RangeError);
  });
  it('recomputes with current content, counts actual results and never certifies unknown licensing', () => {
    const { organization, assessment } = entities();
    const before = structuredClone({ organization, assessment });
    const report = buildReadout(content, organization, assessment, 'current');
    expect(report.result.contentVersion).toBe('current');
    expect(report.summary).toHaveLength(3);
    expect(report.metrics.capabilityCount).toBe(report.result.inScope.length);
    expect(Object.values(report.metrics.levels).reduce((a, b) => a + b, 0)).toBe(
      report.result.inScope.length,
    );
    expect(report.metrics.platform).toBe(
      report.result.inScope.filter((r) => r.capability.setup !== 'agent').length,
    );
    expect(report.result.licensing.eligibility).toBe('unknown');
    expect(report.metrics.readinessPercent).toBe(report.result.readiness.percent);
    expect({ organization, assessment }).toEqual(before);
  });
  it('preserves unknown answers and exports evidence, version, roadmap and the disclaimer', () => {
    const { organization, assessment } = entities();
    const report = buildReadout(content, organization, assessment, 'current');
    const markdown = readoutMarkdown(content, report);
    for (const text of [
      content.site.readout.draft,
      content.site.readout.roadmap,
      'current',
      content.site.disclaimer,
      ...report.result.matchedRuleIds,
    ])
      expect(markdown).toContain(text);
    expect(answerLabel(content, {}, 'preparedBy')).toBe(content.site.mapping.unknownAnswer);
    expect(() => answerLabel(content, {}, 'missing')).toThrow(/Unknown readout question/);
  });
  it('escapes user Markdown and HTML instead of creating active markup', () => {
    const { organization, assessment } = entities();
    assessment.answers.useCaseName = '<img src="https://example.invalid/x"> ![x](remote)';
    const markdown = readoutMarkdown(
      content,
      buildReadout(content, organization, assessment, 'current'),
    );
    expect(markdown).not.toContain('<img');
    expect(markdown).not.toContain('![x](');
    expect(markdown).toContain('&lt;img');
  });
  it('exports every numbered exhibit exactly once and in reading order, with appendix and discovery', () => {
    const { organization, assessment } = entities();
    const report = buildReadout(content, organization, assessment, 'current');
    const markdown = readoutMarkdown(content, report);
    const plan = exhibitPlan(true);
    expect(plan).toHaveLength(Object.keys(content.site.readout.exhibits).length);
    let previous = -1;
    for (const [i, key] of plan.entries()) {
      const heading = renderTemplate(content.site.ui.exhibit.eyebrow, {
        number: i + 1,
        label: content.site.readout.exhibits[key],
      });
      expect(markdown.split(heading)).toHaveLength(2);
      const position = markdown.indexOf(heading);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    for (const required of [
      content.site.readout.appendix,
      content.site.readout.eligibility,
      content.site.readout.methodologyNote,
      content.site.readout.discovery,
      ...report.result.unknownRuleIds,
    ])
      expect(markdown).toContain(required);
  });
  it('names the customer in the title and puts the requirement areas first', () => {
    const { organization, assessment } = entities();
    const report = buildReadout(content, organization, assessment, 'current');
    expect(report.title).toBe(
      renderTemplate(content.site.readout.title, {
        label: 'Fictional readout',
        organization: 'Fictional organization',
      }),
    );
    expect(report.title).toContain('Fictional organization');
    const markdown = readoutMarkdown(content, report);
    expect(markdown.startsWith(`# ${report.title}`)).toBe(true);
    const heading = (number: number, key: keyof typeof content.site.readout.exhibits) =>
      renderTemplate(content.site.ui.exhibit.eyebrow, {
        number,
        label: content.site.readout.exhibits[key],
      });
    expect(markdown).toContain(`## ${heading(1, 'pillars')}`);
    expect(markdown.indexOf(heading(1, 'pillars'))).toBeLessThan(
      markdown.indexOf(heading(2, 'anatomy')),
    );
  });
  it('groups the in-scope capabilities by requirement area and counts them against the catalog', () => {
    const { organization, assessment } = entities();
    const report = buildReadout(content, organization, assessment, 'current');
    expect(report.pillars.map((row) => row.pillar.id)).toEqual(
      [...content.pillars].sort((a, b) => a.order - b.order).map((p) => p.id),
    );
    expect(sum(report.pillars.map((row) => row.items.length))).toBe(report.result.inScope.length);
    const markdown = readoutMarkdown(content, report);
    for (const row of report.pillars) {
      expect(markdown).toContain(`### ${escapeMarkdown(pillarLabel(content, row.pillar))}`);
      expect(markdown).toContain(
        escapeMarkdown(
          renderTemplate(content.site.mapping.pillarCount, {
            count: row.items.length,
            total: row.catalogTotal,
          }),
        ),
      );
      for (const { capability } of row.items)
        expect(markdown).toContain(`- ${escapeMarkdown(capability.shortName)} —`);
    }
  });
  it('lists the owner teams to involve and the open questions with the areas they inform', () => {
    const { organization, assessment } = entities();
    delete assessment.answers.accessModel;
    const report = buildReadout(content, organization, assessment, 'current');
    const markdown = readoutMarkdown(content, report);
    const people = peopleRows(content, report.result.inScope);
    expect(people.length).toBeGreaterThan(0);
    for (const row of people) expect(markdown).toContain(`- ${escapeMarkdown(row.team)} —`);
    const question = report.result.openQuestions.find((q) => q.id === 'accessModel')!;
    const areas = [...questionPillars(content).get('accessModel')!];
    expect(areas.length).toBeGreaterThan(0);
    expect(markdown).toContain(
      escapeMarkdown(
        renderTemplate(content.site.mapping.informs, {
          label: content.pillars
            .filter((p) => areas.includes(p.id))
            .map((p) => p.requirement)
            .join(', '),
        }),
      ),
    );
    expect(markdown).toContain(escapeMarkdown(question.label));
  });
  it('marks answers the customer has not confirmed in the canvas, the summary and the export', () => {
    const { organization, assessment } = entities();
    assessment.assumedQuestionIds = ['autonomy', 'businessOutcome'];
    const report = buildReadout(content, organization, assessment, 'current');
    const mark = content.site.readout.assumedMark;
    expect(report.assumed).toEqual(['autonomy']);
    expect(report.summary).toHaveLength(4);
    expect(report.summary.at(-1)).toBe(
      renderTemplate(content.site.readout.assumedTakeaway, { count: 1 }),
    );
    const label = answerLabel(content, report.answers, 'autonomy');
    expect(answerText(content, report, 'autonomy')).toBe(`${label} (${mark})`);
    expect(answerText(content, report, 'accessModel')).not.toContain(mark);
    const boxes = canvasFields(content, report);
    expect(boxes.find((box) => box.id === 'autonomy')!.body).toContain(
      `${content.questions.find((q) => q.id === 'autonomy')!.label}: ${label} (${mark})`,
    );
    expect(boxes.find((box) => box.id === 'identity')!.body).not.toContain(mark);
    const markdown = readoutMarkdown(content, report);
    expect(markdown).toContain(mark);
    expect(markdown).toContain(`${escapeMarkdown(`${label} (${mark})`)}`);

    delete assessment.assumedQuestionIds;
    const confirmed = buildReadout(content, organization, assessment, 'current');
    expect(confirmed.assumed).toEqual([]);
    expect(confirmed.summary).toHaveLength(3);
    expect(readoutMarkdown(content, confirmed)).not.toContain(mark);
  });
  it('compares what-if deltas without changing saved answers', () => {
    const { organization, assessment } = entities();
    const input = { org: organization.answers, useCase: assessment.answers };
    const before = structuredClone(input);
    expect(evaluateWhatIfs(content, input, 'current')).toHaveLength(content.whatIfs.length);
    expect(input).toEqual(before);
  });
});
