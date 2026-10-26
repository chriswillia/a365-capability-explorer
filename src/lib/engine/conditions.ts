import type { Answers, Condition, Diagnostic, Question, Site } from '../content/schemas.ts';
import { knownAnswer } from './answers.ts';

export type Truth = boolean | null;

export function questionIsVisible(id: string, diagnostic: Diagnostic, answers: Answers): boolean {
  return diagnostic.visibility
    .filter((v) => v.questionId === id)
    .every((v) => evaluateCondition(v.when, answers) === true);
}

export function evaluateCondition(condition: Condition, answers: Answers): Truth {
  if ('always' in condition) return true;
  if ('not' in condition) {
    const value = evaluateCondition(condition.not, answers);
    return value === null ? null : !value;
  }
  if ('all' in condition || 'any' in condition) {
    const values = ('all' in condition ? condition.all : condition.any).map((c) =>
      evaluateCondition(c, answers),
    );
    if ('all' in condition)
      return values.includes(false) ? false : values.includes(null) ? null : true;
    return values.includes(true) ? true : values.includes(null) ? null : false;
  }
  const answer = answers[condition.q];
  const known = knownAnswer(answer);
  if (condition.answered !== undefined) return condition.answered === known;
  if (condition.unknown !== undefined) return condition.unknown === !known;
  if (!known) return null;
  if (condition.equals !== undefined) return answer === condition.equals;
  if (condition.in !== undefined)
    return typeof answer === 'string' && condition.in.includes(answer);
  if (condition.includes !== undefined)
    return Array.isArray(answer) && answer.includes(condition.includes);
  if (condition.includesAny !== undefined)
    return Array.isArray(answer) && condition.includesAny.some((v) => answer.includes(v));
  throw new Error(`Condition for "${condition.q}" has no operator`);
}

export function conditionQuestions(condition: Condition): string[] {
  if ('q' in condition) return [condition.q];
  if ('not' in condition) return conditionQuestions(condition.not);
  if ('always' in condition) return [];
  return [
    ...new Set(('all' in condition ? condition.all : condition.any).flatMap(conditionQuestions)),
  ];
}

export function describeCondition(
  condition: Condition,
  questions: Question[],
  copy: Site['mapping']['condition'],
): string {
  if ('always' in condition) return copy.always;
  if ('not' in condition)
    return `${copy.not} (${describeCondition(condition.not, questions, copy)})`;
  if ('all' in condition || 'any' in condition) {
    const children = 'all' in condition ? condition.all : condition.any;
    return `${'all' in condition ? copy.all : copy.any}: (${children.map((c) => describeCondition(c, questions, copy)).join('; ')})`;
  }
  const question = questions.find((q) => q.id === condition.q);
  if (!question) throw new Error(`Cannot describe unknown question "${condition.q}"`);
  const option = (value: string) => {
    const label = question.options.find((o) => o.value === value)?.label;
    if (!label) throw new Error(`Cannot describe unknown option "${value}" for "${question.id}"`);
    return label;
  };
  let phrase: string;
  if (condition.equals !== undefined) phrase = `${copy.equals} ${option(condition.equals)}`;
  else if (condition.in !== undefined) phrase = `${copy.in} ${condition.in.map(option).join(', ')}`;
  else if (condition.includes !== undefined)
    phrase = `${copy.includes} ${option(condition.includes)}`;
  else if (condition.includesAny !== undefined)
    phrase = `${copy.includesAny} ${condition.includesAny.map(option).join(', ')}`;
  else if (condition.answered !== undefined)
    phrase = condition.answered ? copy.answered : copy.unanswered;
  else if (condition.unknown !== undefined) phrase = condition.unknown ? copy.unknown : copy.known;
  else throw new Error(`Condition for "${question.id}" has no operator`);
  return `${question.label} ${phrase}`;
}
