import { PASSPORT_QUESTION_IDS } from '../content/constants.ts';
import type { PopulationView } from '../content/licensing.ts';
import type { Answers, Content, Guardrails } from '../content/schemas.ts';
import { knownAnswer } from './answers.ts';
import type { AssessmentAnswers } from './evaluate.ts';
import { byUrgency, evaluateGuardrails, type GuardrailView } from './guardrails.ts';
import { buildPassport, type Passport } from './passport.ts';

type Gate = Guardrails['gates'][number];
type Statement = Content['value']['problem']['statements'][number];

/** How many controls for each area, go-live steps for each gate, and questions to confirm fit on the page and the slides. */
export const CONTROL_LIMIT = 5;
export const STEP_LIMIT = 3;
export const QUESTION_LIMIT = 6;

/** An agent that is scaling has three gates in play instead of two, so each shows one step fewer to stay on one page. */
export const stepLimit = (gates: number): number => (gates > 2 ? STEP_LIMIT - 1 : STEP_LIMIT);

export interface LeaveBehindStep {
  gate: Gate;
  /** Gaps first, then what is still to confirm, then what is in place. */
  items: GuardrailView[];
}

export interface LeaveBehind {
  passport: Passport;
  /** The rollout stage the answers give, or null while it is missing. */
  stage: string | null;
  /** Why it matters, in statements Microsoft's own pages support. */
  why: Statement[];
  /** The gates that matter at this stage: a pilot and production, and scale once the agent is scaling. */
  steps: LeaveBehindStep[];
  /** The people Microsoft says to license, by how much it asks of them. */
  license: { required: PopulationView[]; recommended: PopulationView[] };
  /** Everything not confirmed, in one list: unanswered questions, requirements to ask about and licensing to check. */
  questions: string[];
  /** The Microsoft sources behind the facts on the page, each once. */
  sourceIds: string[];
}

const unique = (values: string[]) => [...new Set(values)];

/**
 * What to leave with the customer for one agent. It adds nothing the passport and the guardrail checklist do not
 * already say: it picks the parts that fit on a page and collects every unknown on one list, so an unknown never
 * becomes a headline.
 */
export function buildLeaveBehind(
  data: Content,
  input: AssessmentAnswers,
  version: string,
): LeaveBehind {
  const passport = buildPassport(data, input, version);
  const answers: Answers = { ...input.org, ...input.useCase };
  const stage =
    typeof answers.stage === 'string' && knownAnswer(answers.stage) ? answers.stage : null;
  const plan = evaluateGuardrails(data, answers);
  const inPlay = stage === 'scaling' ? plan.gates : plan.gates.filter((g) => g.gate.id !== 'scale');
  const steps = inPlay
    .map(({ gate, items }): LeaveBehindStep => ({ gate, items: byUrgency(items) }))
    .filter((step) => step.items.length > 0);

  const why = data.leaveBehind.whyStatementIds.flatMap((id) =>
    data.value.problem.statements.filter((statement) => statement.id === id),
  );
  const license = {
    required: passport.populations.filter((view) => view.population.need === 'required'),
    recommended: passport.populations.filter((view) => view.population.need === 'recommended'),
  };

  const unanswered = PASSPORT_QUESTION_IDS.filter((id) => !knownAnswer(answers[id])).flatMap(
    (id) => data.questions.find((question) => question.id === id)?.ifUnknown ?? [],
  );
  const asks = passport.requirements.flatMap((view) =>
    view.status === 'unknown' && view.item.askPrompt !== undefined ? [view.item.askPrompt] : [],
  );
  const licensingToCheck = passport.populations.flatMap((view) =>
    view.population.need === 'not-stated'
      ? [view.population.confirm ?? view.population.statement]
      : [],
  );

  return {
    passport,
    stage,
    why,
    steps,
    license,
    questions: unique([...unanswered, ...asks, ...licensingToCheck]),
    sourceIds: unique([
      ...why.flatMap((statement) => statement.sourceIds),
      ...license.required.flatMap((view) => view.population.sourceIds),
    ]),
  };
}
