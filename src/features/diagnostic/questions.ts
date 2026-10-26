import type { Answers, Content, Question } from '../../lib/content/schemas.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import { questionIsVisible } from '../../lib/engine/conditions.ts';
import type { DiagnosticMode } from '../../lib/state/diagnostic-model.ts';

export function diagnosticSections(data: Content, mode: DiagnosticMode, answers: Answers) {
  return data.diagnostic.sections
    .map((section) => ({
      ...section,
      questions: section.questionIds
        .map((id) => data.questions.find((q) => q.id === id)!)
        .filter(
          (q) =>
            (mode === 'full' || data.diagnostic.quickQuestionIds.includes(q.id)) &&
            questionIsVisible(q.id, data.diagnostic, answers),
        ),
    }))
    .filter((section) => section.questions.length > 0);
}

export function compatibleAnswers(
  questions: Question[],
  answers: Answers,
  scope: Question['scope'],
): Answers {
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([id, value]) => answerErrors(questions, { [id]: value }, scope).length === 0,
    ),
  );
}
