import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { computePortfolioMetrics, computeWorkshopMinutes } from '../content/metrics.ts';
import { patternAnswers } from '../engine/evaluate.ts';
import { emptyWorkspace } from '../state/diagnostic-model.ts';
import {
  appendDiagnosticBundle,
  diagnosticBundle,
  parseDiagnosticBundle,
} from '../state/diagnostic-transfer.ts';
import { buildPortfolio, planningQuadrant, portfolioLevel } from './portfolio.ts';

function fixture() {
  const data = emptyWorkspace();
  const answers = patternAnswers(content, 'process-agent', 'askhr');
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: 'old',
  };
  const organizationId = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  data.organizations.push(
    { ...entity, id: organizationId, answers: answers.org },
    { ...entity, id: otherId, answers: {} },
  );
  for (const [i, org] of [organizationId, organizationId, otherId].entries())
    data.assessments.push({
      ...entity,
      id: crypto.randomUUID(),
      organizationId: org,
      answers: { ...answers.useCase, useCaseName: `Case ${i}`, businessValue: String(i + 3) },
      mode: 'full',
      sectionId: 'review',
      patternId: null,
      sampleId: null,
    });
  const ids = data.assessments.slice(0, 2).map((item) => item.id);
  return { data, organizationId, otherId, ids };
}

describe('portfolio planning', () => {
  it.each([
    [null, 50, null],
    [2, 49, 'experiment'],
    [2, 50, 'reconsider'],
    [3, 49, 'accelerate'],
    [3, 50, 'govern'],
    [5, 100, 'govern'],
    [1, 0, 'experiment'],
  ] as const)(
    'uses the exact approved boundary: value %s, intensity %s => %s',
    (value, intensity, quadrant) => {
      expect(planningQuadrant(value, intensity, content.site.portfolio)).toBe(quadrant);
    },
  );

  it('deduplicates platform foundations, preserves every heatmap level and never mutates saves', () => {
    const { data, organizationId, ids } = fixture();
    const before = structuredClone(data);
    const portfolio = buildPortfolio(content, data, 'current', organizationId, ids);
    const result = portfolio.cases[0]!.result;
    expect(portfolio.cases).toHaveLength(2);
    expect(portfolio.foundations.map((row) => row.capability.id).sort()).toEqual(
      result.inScope
        .filter((row) => row.capability.setup !== 'agent')
        .map((row) => row.capability.id)
        .sort(),
    );
    expect(portfolio.foundations.every((row) => row.uses.length === 2)).toBe(true);
    for (const row of portfolio.capabilities)
      for (const item of portfolio.cases)
        expect(portfolioLevel(row, item.assessment.id)).toBe(
          item.result.inScope.find((match) => match.capability.id === row.capability.id)?.level ??
            null,
        );
    const metrics = computePortfolioMetrics(portfolio);
    expect(metrics.uniqueCapabilities).toBe(result.inScope.length);
    expect(metrics.foundational + metrics.premium).toBe(metrics.uniqueCapabilities);
    expect(portfolio.cases.every((item) => item.result.contentVersion === 'current')).toBe(true);
    expect(portfolio.cases.every((item) => item.result.licensing.eligibility === 'unknown')).toBe(
      true,
    );
    expect(data).toEqual(before);
  });

  it('separates gap, ready and unknown results for the same check, without averaging percentages', () => {
    const { data, organizationId, ids } = fixture();
    const configured = structuredClone(content);
    configured.capabilities.forEach((capability) => {
      capability.prerequisites = [];
    });
    configured.mappingConfig.readinessChecks = [
      {
        id: 'value-check',
        appliesWhen: { always: true },
        when: { q: 'businessValue', equals: '3' },
        gap: 'Discuss value assumptions',
        evidence: 'judgment',
        sourceId: 'sd-a365',
      },
    ];
    data.assessments[1]!.answers.businessValue = null;
    let portfolio = buildPortfolio(configured, data, 'current', organizationId, ids);
    expect(portfolio.checks[0]!.gapCases).toHaveLength(1);
    expect(portfolio.checks[0]!.unknown).toHaveLength(1);
    expect(computePortfolioMetrics(portfolio)).toMatchObject({
      gaps: 1,
      unknown: 1,
      readinessPercent: 0,
      unplotted: 1,
    });
    data.assessments[1]!.answers.businessValue = '4';
    portfolio = buildPortfolio(configured, data, 'current', organizationId, ids);
    expect(portfolio.checks[0]!.ready).toHaveLength(1);
    expect(computePortfolioMetrics(portfolio).readinessPercent).toBe(50);
    configured.mappingConfig.readinessChecks = [];
    expect(
      computePortfolioMetrics(buildPortfolio(configured, data, 'current', organizationId, ids))
        .readinessPercent,
    ).toBeNull();
  });

  it('keeps unknown values and user bands explicit; never invents an exact audience', () => {
    const { data, organizationId, ids } = fixture();
    data.assessments[0]!.answers.businessValue = 'unknown';
    data.assessments[0]!.answers.expectedUsers = null;
    data.assessments[1]!.answers.expectedUsers = 'gt-5000';
    const portfolio = buildPortfolio(content, data, 'current', organizationId, ids);
    expect(portfolio.cases[0]).toMatchObject({ value: null, userBand: null, quadrant: null });
    expect(portfolio.cases[1]).toMatchObject({ userBand: 3 });
    expect(portfolio.cases[1]!.result.licensing.expectedUsers).toEqual({ min: 5001, max: null });
  });

  it('blocks incompatible assessments or organizations with explicit errors and no silent correction', () => {
    const { data, organizationId, ids } = fixture();
    data.assessments[0]!.answers.retiredQuestion = 'retained';
    let portfolio = buildPortfolio(content, data, 'current', organizationId, ids);
    expect(portfolio.blocked).toHaveLength(1);
    expect(portfolio.blocked[0]!.errors.join()).toContain('retiredQuestion');
    expect(portfolio.cases).toHaveLength(1);
    expect(portfolio.foundations).toHaveLength(0);
    data.organizations[0]!.answers.retiredOrgQuestion = 'retained';
    portfolio = buildPortfolio(content, data, 'current', organizationId, ids);
    expect(portfolio.blocked).toHaveLength(2);
    expect(portfolio.cases).toHaveLength(0);
    expect(data.assessments[0]!.answers.retiredQuestion).toBe('retained');
  });

  it('accepts empty selections but rejects cross-organization, duplicate and nonexistent ids', () => {
    const { data, organizationId, otherId, ids } = fixture();
    expect(buildPortfolio(content, data, 'current', organizationId, []).cases).toEqual([]);
    expect(() =>
      buildPortfolio(content, data, 'current', organizationId, [ids[0]!, ids[0]!]),
    ).toThrow('distinct');
    expect(() => buildPortfolio(content, data, 'current', otherId, ids)).toThrow(
      'one organization',
    );
    expect(() => buildPortfolio(content, data, 'current', 'missing', [])).toThrow('does not exist');
    expect(() => buildPortfolio(content, data, 'current', organizationId, ['missing'])).toThrow(
      'distinct',
    );
  });

  it('round trips only selected portfolio assessments and referenced organizations as new copies', () => {
    const { data, ids } = fixture();
    const bundle = diagnosticBundle(data, 'current', ids);
    expect(bundle.workspace.organizations).toHaveLength(1);
    expect(bundle.workspace.assessments.map((item) => item.id)).toEqual(ids);
    expect(parseDiagnosticBundle(JSON.stringify(bundle))).toEqual({ ok: true, bundle });
    const merged = appendDiagnosticBundle(data, bundle);
    expect(merged.organizations).toHaveLength(3);
    expect(merged.assessments).toHaveLength(5);
    expect(new Set(merged.assessments.map((item) => item.id)).size).toBe(5);
    expect(merged.assessments[3]!.organizationId).toBe(merged.organizations[2]!.id);
    expect(merged.assessments[3]!.contentVersion).toBe('old');
    expect(() => diagnosticBundle(data, 'current', [ids[0]!, ids[0]!])).toThrow('duplicate');
    expect(() => diagnosticBundle(data, 'current', ['missing'])).toThrow('does not exist');
  });

  it('computes the workshop duration from the agenda, not a typed headline', () => {
    expect(computeWorkshopMinutes(content.workshop.agenda)).toBe(90);
    expect(computeWorkshopMinutes([{ minutes: 7 }, { minutes: 11 }])).toBe(18);
  });
});
