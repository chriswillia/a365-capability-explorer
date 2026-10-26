import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import type { Answers } from '../../lib/content/schemas.ts';
import { answerErrors, knownAnswer } from '../../lib/engine/answers.ts';
import { evaluateAssessment } from '../../lib/engine/evaluate.ts';
import { compatibleAnswers, diagnosticSections } from './questions.ts';

describe('diagnostic questions', () => {
  it('matches the configured quick scan without losing full-only answers', () => {
    const answers = { businessOutcome: 'A preserved outcome', buildPlatform: 'pro-code-microsoft' };
    const quick = diagnosticSections(content, 'quick', answers).flatMap((s) =>
      s.questions.map((q) => q.id),
    );
    expect(quick.sort()).toEqual([...content.diagnostic.quickQuestionIds].sort());
    expect(diagnosticSections(content, 'full', answers).flatMap((s) => s.questions)).toHaveLength(
      content.questions.length,
    );
    expect(answers.businessOutcome).toBe('A preserved outcome');
    expect(quick).not.toContain('businessOutcome');
  });
  it('shows developer stack only for pro-code and suppresses hidden open questions', () => {
    for (const [platform, visible] of [
      ['copilot-studio', false],
      ['pro-code-microsoft', true],
      ['pro-code-third-party', true],
    ] as const) {
      expect(
        diagnosticSections(content, 'full', { buildPlatform: platform })
          .flatMap((s) => s.questions)
          .some((q) => q.id === 'codeStack'),
      ).toBe(visible);
      expect(
        evaluateAssessment(
          content,
          { org: {}, useCase: { buildPlatform: platform } },
          'test',
        ).openQuestions.some((q) => q.id === 'codeStack'),
      ).toBe(visible);
    }
    expect(diagnosticSections(content, 'full', {}).flatMap((s) => s.questions)).toHaveLength(
      content.questions.length - 1,
    );
  });
  it('validates text bounds, real dates, scale values and multi-select exclusivity', () => {
    expect(
      answerErrors(content.questions, {
        businessOutcome: 'x'.repeat(2000),
        preparedOn: '2028-02-29',
        businessValue: '5',
      }),
    ).toEqual([]);
    const invalid: Answers[] = [
      { businessOutcome: 'x'.repeat(2001) },
      { preparedOn: '2026-02-29' },
      { preparedOn: '2026-13-01' },
      { businessValue: '6' },
      { tools: ['none', 'computer-use'] },
    ];
    for (const answers of invalid) {
      expect(answerErrors(content.questions, answers)).not.toEqual([]);
    }
    for (const answer of ['', '   ', null, [], 'unknown', ['unknown']])
      expect(knownAnswer(answer)).toBe(false);
    expect(answerErrors(content.questions, { businessOutcome: '  ', preparedOn: '  ' })).toEqual(
      [],
    );
  });
  it('clears only incompatible answers, including wrong-scope and retired questions', () => {
    const answers = {
      useCaseName: 'Keep this',
      tools: ['none', 'computer-use'],
      businessValue: '9',
      retired: 'old',
      cloudEnvironment: 'gcc',
      businessOutcome: '',
    };
    expect(compatibleAnswers(content.questions, answers, 'useCase')).toEqual({
      useCaseName: 'Keep this',
      businessOutcome: '',
    });
  });
});
