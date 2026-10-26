import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { evaluateWhatIfs, patternAnswers } from '../engine/evaluate.ts';
import type { Assessment, Organization } from '../state/diagnostic-model.ts';
import {
  answerLabel,
  buildReadout,
  canvasFields,
  readoutMarkdown,
  summarizeText,
} from './report.ts';
import { renderTemplate } from '../content/template.ts';

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
  it('exports all eleven numbered exhibits exactly once, with appendix and discovery', () => {
    const { organization, assessment } = entities();
    const report = buildReadout(content, organization, assessment, 'current');
    const markdown = readoutMarkdown(content, report);
    const titles = Object.values(content.site.readout.exhibits);
    for (let i = 0; i < titles.length; i++) {
      const heading = renderTemplate(content.site.ui.exhibit.eyebrow, {
        number: i + 1,
        label: titles[i]!,
      });
      expect(markdown.split(heading)).toHaveLength(2);
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
  it('compares what-if deltas without changing saved answers', () => {
    const { organization, assessment } = entities();
    const input = { org: organization.answers, useCase: assessment.answers };
    const before = structuredClone(input);
    expect(evaluateWhatIfs(content, input, 'current')).toHaveLength(content.whatIfs.length);
    expect(input).toEqual(before);
  });
});
