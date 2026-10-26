import { describe, expect, it } from 'vitest';
import { ConditionSchema, GoldenScenarioSchema, RuleSchema, QuestionSchema } from './schemas.ts';

describe('mapping schemas', () => {
  it.each([
    { q: 'stage' },
    { q: 'stage', equals: 'pilot', answered: true },
    { any: [] },
    { always: false },
  ])('rejects ambiguous or empty conditions', (condition) => {
    expect(ConditionSchema.safeParse(condition).success).toBe(false);
  });
  it('requires valid recommendation levels, evidence, sources and an actual rule output', () => {
    const rule = {
      id: 'baseline',
      scope: 'useCase',
      description: 'Baseline',
      when: { always: true },
      recommend: [],
      advisories: [],
      reviewStatus: 'draft',
    };
    expect(RuleSchema.safeParse(rule).success).toBe(false);
    const recommendation = {
      capability: 'registry-inventory',
      level: 'essential',
      because: 'Inventory supports governance.',
      evidence: 'inferred',
      sourceIds: ['sd-a365'],
    };
    expect(RuleSchema.safeParse({ ...rule, recommend: [recommendation] }).success).toBe(true);
    expect(
      RuleSchema.safeParse({ ...rule, recommend: [{ ...recommendation, level: 'required' }] })
        .success,
    ).toBe(false);
  });
  it('requires question options, scope and unknown-answer guidance', () => {
    expect(
      QuestionSchema.safeParse({
        id: 'stage',
        type: 'single',
        scope: 'useCase',
        label: 'Stage',
        options: [],
        ifUnknown: 'Confirm the stage.',
      }).success,
    ).toBe(false);
  });
  it('does not allow partial SME signoff', () => {
    const scenario = {
      id: 'test',
      patternId: 'test',
      org: {},
      answers: {},
      mustInclude: ['registry-inventory'],
      mustNotInclude: [],
      reviewedBy: null,
      reviewedOn: null,
    };
    expect(GoldenScenarioSchema.safeParse(scenario).success).toBe(true);
    expect(GoldenScenarioSchema.safeParse({ ...scenario, reviewedOn: '2026-10-25' }).success).toBe(
      false,
    );
  });
});
