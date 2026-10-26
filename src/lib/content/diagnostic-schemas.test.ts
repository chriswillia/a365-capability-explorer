import { describe, expect, it } from 'vitest';
import { answerErrors } from '../engine/answers.ts';
import { QuestionSchema } from './schemas.ts';

describe('diagnostic question schemas', () => {
  const text = {
    id: 'useCaseName',
    scope: 'useCase',
    type: 'text',
    label: 'Name',
    maxLength: 120,
    ifUnknown: 'Add a name.',
  };
  it('supports bounded text, long text, dates and labeled scales without weakening choice validation', () => {
    expect(QuestionSchema.parse(text).options).toEqual([]);
    expect(QuestionSchema.safeParse({ ...text, maxLength: undefined }).success).toBe(false);
    expect(
      QuestionSchema.safeParse({ ...text, options: [{ value: 'x', label: 'X' }] }).success,
    ).toBe(false);
    expect(QuestionSchema.safeParse({ ...text, type: 'single', options: [] }).success).toBe(false);
    const q = QuestionSchema.parse(text);
    expect(answerErrors([q], { useCaseName: 'A useful agent' })).toEqual([]);
    expect(answerErrors([q], { useCaseName: 'x'.repeat(121) })).toHaveLength(1);
    const date = QuestionSchema.parse({ ...text, id: 'preparedOn', type: 'date', maxLength: 10 });
    expect(answerErrors([date], { preparedOn: '2026-02-29' })).toHaveLength(1);
    expect(answerErrors([date], { preparedOn: '2026-10-26' })).toEqual([]);
  });
});
