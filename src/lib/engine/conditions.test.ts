import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import type { Answers, Condition } from '../content/schemas.ts';
import { answerErrors } from './answers.ts';
import { describeCondition, evaluateCondition } from './conditions.ts';

describe('three-valued conditions', () => {
  it.each<[Condition, Answers, boolean | null]>([
    [{ always: true }, {}, true],
    [{ q: 'stage', equals: 'pilot' }, {}, null],
    [{ not: { q: 'stage', equals: 'pilot' } }, {}, null],
    [{ not: { q: 'stage', equals: 'pilot' } }, { stage: 'unknown' }, null],
    [{ q: 'stage', equals: 'pilot' }, { stage: 'pilot' }, true],
    [{ q: 'stage', in: ['pilot', 'production'] }, { stage: 'idea' }, false],
    [{ q: 'tools', includes: 'microsoft-mcp' }, { tools: ['microsoft-mcp'] }, true],
    [{ q: 'tools', includesAny: ['computer-use', 'web-browsing'] }, { tools: ['none'] }, false],
    [{ q: 'tools', includes: 'computer-use' }, { tools: [] }, null],
    [{ q: 'stage', answered: false }, { stage: null }, true],
    [{ q: 'stage', unknown: true }, { stage: '' }, true],
    [{ q: 'stage', unknown: false }, { stage: 'pilot' }, true],
    [
      {
        all: [
          { q: 'stage', equals: 'pilot' },
          { q: 'sponsor', equals: 'yes' },
        ],
      },
      { stage: 'idea' },
      false,
    ],
    [
      {
        all: [
          { q: 'stage', equals: 'pilot' },
          { q: 'sponsor', equals: 'yes' },
        ],
      },
      { stage: 'pilot' },
      null,
    ],
    [
      {
        any: [
          { q: 'stage', equals: 'pilot' },
          { q: 'sponsor', equals: 'yes' },
        ],
      },
      { stage: 'pilot' },
      true,
    ],
    [
      {
        any: [
          { q: 'stage', equals: 'pilot' },
          { q: 'sponsor', equals: 'yes' },
        ],
      },
      { stage: 'idea' },
      null,
    ],
  ])('evaluates %j with %j as %s', (condition, answers, expected) => {
    expect(evaluateCondition(condition, answers)).toBe(expected);
  });
  it('uses question and option labels, including nested and missing-answer operators', () => {
    const render = (c: Condition) =>
      describeCondition(c, content.questions, content.site.mapping.condition);
    expect(render({ q: 'accessModel', equals: 'own-teammate' })).toBe(
      'Access model is Own access as an AI teammate',
    );
    expect(
      render({
        all: [
          { q: 'stage', in: ['pilot', 'production'] },
          { not: { q: 'tools', includes: 'computer-use' } },
        ],
      }),
    ).toBe(
      'All of: (Agent rollout stage is one of Pilot, Production; Not (Tools and execution includes Computer use))',
    );
    expect(render({ q: 'tools', includesAny: ['web-browsing', 'computer-use'] })).toContain(
      'Web browsing, Computer use',
    );
    expect(render({ q: 'sponsor', answered: false })).toBe('Named sponsor has no known answer');
    expect(render({ q: 'sponsor', unknown: true })).toBe('Named sponsor is unknown');
    expect(() => render({ q: 'missing', equals: 'x' })).toThrow('unknown question');
    expect(() => render({ q: 'stage', equals: 'typo' })).toThrow('unknown option');
  });
  it('rejects invalid answer shapes, scopes, options and conflicting multi-selects', () => {
    const invalid: Answers[] = [
      { missing: 'yes' },
      { tools: 'none' },
      { stage: ['pilot'] },
      { stage: 'typo' },
      { tools: ['none', 'microsoft-mcp'] },
      { tools: ['unknown', 'microsoft-mcp'] },
      { tools: ['none', 'none'] },
    ];
    for (const answers of invalid) {
      expect(answerErrors(content.questions, answers).length).toBeGreaterThan(0);
    }
    expect(answerErrors(content.questions, { stage: 'pilot' }, 'org')).toHaveLength(1);
    expect(answerErrors(content.questions, { stage: null, tools: ['unknown'] })).toEqual([]);
  });
});
