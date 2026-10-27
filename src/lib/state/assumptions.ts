import type { Answers } from '../content/schemas.ts';
import { knownAnswer } from '../engine/answers.ts';

/**
 * The use-case answers a scenario or sample supplied when an assessment was started. The use case name is a
 * title, not an assumption about the agent, so it is never marked.
 */
export const seededAssumptions = (answers: Answers): string[] =>
  Object.keys(answers).filter((id) => id !== 'useCaseName' && knownAnswer(answers[id]));

/** The assumptions that still stand: not yet confirmed or edited, and the answer is still known. */
export const standingAssumptions = (assessment: {
  assumedQuestionIds?: string[];
  answers: Answers;
}): string[] =>
  (assessment.assumedQuestionIds ?? []).filter((id) => knownAnswer(assessment.answers[id]));
