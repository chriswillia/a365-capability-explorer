import type { Answers, Question } from '../content/schemas.ts';

export function knownAnswer(answer: Answers[string] | undefined): answer is string | string[] {
  return (
    answer !== undefined &&
    answer !== null &&
    (typeof answer !== 'string' || answer.trim() !== '') &&
    answer !== 'unknown' &&
    (!Array.isArray(answer) || (answer.length > 0 && !answer.includes('unknown')))
  );
}

export function answerErrors(
  questions: Question[],
  answers: Answers,
  scope?: Question['scope'],
): string[] {
  const errors: string[] = [];
  for (const [id, answer] of Object.entries(answers)) {
    const question = questions.find((q) => q.id === id);
    if (!question) {
      errors.push(`unknown question "${id}"`);
      continue;
    }
    if (scope && question.scope !== scope)
      errors.push(`question "${id}" belongs to ${question.scope}, not ${scope}`);
    if (
      answer === null ||
      (typeof answer === 'string' && answer.trim() === '') ||
      answer === 'unknown'
    )
      continue;
    if (question.type === 'multi' ? !Array.isArray(answer) : typeof answer !== 'string') {
      errors.push(`question "${id}" expects a ${question.type} answer`);
      continue;
    }
    if (['text', 'longtext', 'date'].includes(question.type)) {
      if (typeof answer !== 'string') continue;
      if (question.maxLength !== undefined && answer.length > question.maxLength)
        errors.push(`question "${id}" exceeds its text limit`);
      if (
        question.type === 'date' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(answer) ||
          !Number.isFinite(Date.parse(answer)) ||
          new Date(answer).toISOString().slice(0, 10) !== answer)
      )
        errors.push(`question "${id}" has an invalid date`);
      continue;
    }
    const values = typeof answer === 'string' ? [answer] : answer;
    if (new Set(values).size !== values.length)
      errors.push(`question "${id}" has duplicate answers`);
    if (values.length > 1 && values.some((v) => v === 'none' || v === 'unknown')) {
      errors.push(`question "${id}": none and unknown must be exclusive`);
    }
    for (const value of values) {
      if (value !== 'unknown' && !question.options.some((o) => o.value === value)) {
        errors.push(`question "${id}" has unknown option "${value}"`);
      }
    }
  }
  return errors;
}
