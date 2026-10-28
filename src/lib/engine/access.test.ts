import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import type { Answers, Content } from '../content/schemas.ts';
import { evaluateAccessChange, PATTERN_ANSWER, patternsFor, type AccessChange } from './access.ts';
import { evaluateAssessment, patternAnswers } from './evaluate.ts';

const VERSION = 'test-version';
const change = (org: Answers = {}, useCase: Answers = {}, data: Content = content) =>
  evaluateAccessChange(data, { org, useCase }, VERSION);
const inGroups = (result: AccessChange) =>
  result.only.flatMap((group) => group.entries.map((entry) => entry.capabilityId));
const patternIds = content.accessPatterns.patterns.map((pattern) => pattern.id);

describe('patternsFor', () => {
  it.each([
    ['delegated', ['delegated']],
    ['own-background', ['own']],
    ['own-teammate', ['agent-account']],
    ['mixed', ['delegated', 'own', 'agent-account']],
    [undefined, []],
    ['not-an-answer', []],
    [['delegated'], []],
  ])('maps %j to %j', (answer, expected) => {
    expect(patternsFor(content, answer)).toEqual(expected);
  });

  it('reaches every way of acting from exactly one answer', () => {
    for (const id of patternIds) expect(patternsFor(content, PATTERN_ANSWER[id])).toEqual([id]);
  });
});

describe('evaluateAccessChange', () => {
  it('says which capabilities depend on how the agent acts, from the same rules the readout uses', () => {
    const result = change();
    const group = (id: string) =>
      result.only.find((g) => g.entries.some((entry) => entry.capabilityId === id));
    expect(group('entra-conditional-access')?.patterns).toEqual(['delegated']);
    expect(group('entra-access-packages')?.patterns).toEqual(['own', 'agent-account']);
    expect(group('purview-audit-ediscovery')?.patterns).toEqual(['agent-account']);
    expect(result.differs).toBe(true);
  });

  it('does not overstate a difference the documentation does not make', () => {
    const entry = change()
      .only.flatMap((group) => group.entries)
      .find((candidate) => candidate.capabilityId === 'entra-conditional-access');
    expect(entry?.alsoDocumented).toEqual(['own', 'agent-account']);
  });

  it.each(Object.entries(PATTERN_ANSWER))(
    'matches an assessment that answers %s with the readout engine',
    (id, answer) => {
      for (const pattern of content.patterns) {
        const input = patternAnswers(content, pattern.id);
        const result = evaluateAccessChange(content, input, VERSION);
        const expected = evaluateAssessment(
          content,
          { org: input.org, useCase: { ...input.useCase, accessModel: answer } },
          VERSION,
        )
          .inScope.map((entry) => entry.capability.id)
          .sort();
        const actual = [
          ...result.shared,
          ...result.only
            .filter((group) => (group.patterns as string[]).includes(id))
            .flatMap((group) => group.entries.map((entry) => entry.capabilityId)),
        ].sort();
        expect(actual, pattern.id).toEqual(expected);
      }
    },
  );

  it('lists each capability once, in catalog order within a group', () => {
    for (const pattern of content.patterns) {
      const result = evaluateAccessChange(content, patternAnswers(content, pattern.id), VERSION);
      const ids = [...result.shared, ...inGroups(result)];
      expect(new Set(ids).size, pattern.id).toBe(ids.length);
      const order = (id: string) => content.capabilities.findIndex((c) => c.id === id);
      for (const group of result.only) {
        const positions = group.entries.map((entry) => order(entry.capabilityId));
        expect(positions, pattern.id).toEqual([...positions].sort((a, b) => a - b));
        expect(group.patterns.length).toBeGreaterThan(0);
        expect(group.patterns.length).toBeLessThan(patternIds.length);
      }
    }
  });

  it('names the ways of acting the assessment itself describes, and still compares when it is unanswered', () => {
    expect(change({}, { accessModel: 'delegated' }).current).toEqual(['delegated']);
    expect(change({}, { accessModel: 'mixed' }).current).toEqual(patternIds);
    const unanswered = change();
    expect(unanswered.current).toEqual([]);
    expect(unanswered.shared.length).toBeGreaterThan(0);
  });

  it('reports no difference when no rule depends on how the agent acts', () => {
    const data = structuredClone(content);
    data.rules = data.rules.filter((rule) => !JSON.stringify(rule.when).includes('accessModel'));
    const result = change({}, {}, data);
    expect(result.differs).toBe(false);
    expect(result.only).toEqual([]);
    expect(result.shared.length).toBeGreaterThan(0);
  });
});
