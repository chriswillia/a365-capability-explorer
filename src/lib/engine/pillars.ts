import { licensingTier } from '../content/derive.ts';
import type {
  Answers,
  Capability,
  Content,
  Level,
  PillarDef,
  PillarId,
  Question,
} from '../content/schemas.ts';
import { renderTemplate } from '../content/template.ts';
import { knownAnswer } from './answers.ts';
import { conditionQuestions } from './conditions.ts';
import type { InScope } from './evaluate.ts';

export interface PillarRow {
  pillar: PillarDef;
  /** The in-scope capabilities of this pillar, in the order the engine ranks them. */
  items: InScope[];
  levels: Record<Level, number>;
  /** All capabilities in the catalog that belong to the pillar. */
  catalogTotal: number;
  premium: number;
  notInGcc: number;
  owners: string[];
}

const compareText = (a: string, b: string) => a.localeCompare(b, 'en');

/** Groups an assessment's in-scope capabilities by the security, governance or observability pillar. */
export function pillarRows(data: Content, inScope: InScope[]): PillarRow[] {
  return [...data.pillars]
    .sort((a, b) => a.order - b.order)
    .map((pillar) => {
      const items = inScope.filter((item) => item.capability.pillar === pillar.id);
      return {
        pillar,
        items,
        levels: {
          essential: items.filter((item) => item.level === 'essential').length,
          recommended: items.filter((item) => item.level === 'recommended').length,
          consider: items.filter((item) => item.level === 'consider').length,
        },
        catalogTotal: data.capabilities.filter((c) => c.pillar === pillar.id).length,
        premium: items.filter((item) => licensingTier(item.capability) === 'premium').length,
        notInGcc: items.filter((item) => !item.capability.source.gccAvailable).length,
        owners: [...new Set(items.map((item) => item.ownerTeam))].sort(compareText),
      };
    });
}

/**
 * The pillars a question can change. A question informs a pillar when it appears in a rule that recommends a
 * capability of that pillar, or in a readiness check of such a capability. Derived from the rules, not typed.
 */
export function questionPillars(data: Content): Map<string, Set<PillarId>> {
  const pillarOf = new Map(data.capabilities.map((c) => [c.id, c.pillar]));
  const result = new Map<string, Set<PillarId>>();
  const add = (questionId: string, pillar: PillarId | undefined) => {
    if (pillar === undefined) return;
    result.set(questionId, (result.get(questionId) ?? new Set()).add(pillar));
  };
  for (const rule of data.rules)
    for (const questionId of conditionQuestions(rule.when))
      for (const recommendation of rule.recommend)
        add(questionId, pillarOf.get(recommendation.capability));
  for (const capability of data.capabilities)
    for (const check of capability.prerequisites ?? [])
      for (const questionId of conditionQuestions(check.when)) add(questionId, capability.pillar);
  return result;
}

export interface PeopleRow {
  team: string;
  areas: string[];
  capabilities: Capability[];
}

/** The teams that own the in-scope capabilities, the product areas they work in, and what each team owns. */
export function peopleRows(data: Content, inScope: InScope[]): PeopleRow[] {
  const teams = new Map<string, { areas: Set<string>; capabilities: Capability[] }>();
  for (const { capability, ownerTeam } of inScope) {
    const entry = teams.get(ownerTeam) ?? { areas: new Set<string>(), capabilities: [] };
    entry.areas.add(
      data.consoles.find((c) => c.id === capability.source.console)?.displayName ?? '',
    );
    entry.capabilities.push(capability);
    teams.set(ownerTeam, entry);
  }
  return [...teams]
    .sort(([a], [b]) => compareText(a, b))
    .map(([team, entry]) => ({
      team,
      areas: [...entry.areas].sort(compareText),
      capabilities: entry.capabilities,
    }));
}

/** The customer-facing name of a pillar, for example "Security (Secure)", from any content object. */
export const pillarLabel = (data: Content, pillar: PillarDef): string =>
  renderTemplate(data.site.capabilities.pillarName, {
    requirement: pillar.requirement,
    label: pillar.label,
  });

export interface PillarCoverage {
  pillar: PillarDef;
  questions: Question[];
  answered: number;
  assumed: number;
  total: number;
}

/** For each pillar: how many of the visible questions that can change it have a known answer. */
export function pillarCoverage(
  data: Content,
  answers: Answers,
  visibleQuestionIds: ReadonlySet<string>,
  assumedQuestionIds: ReadonlySet<string> = new Set(),
): PillarCoverage[] {
  const informs = questionPillars(data);
  return [...data.pillars]
    .sort((a, b) => a.order - b.order)
    .map((pillar) => {
      const questions = data.questions.filter(
        (q) => visibleQuestionIds.has(q.id) && informs.get(q.id)?.has(pillar.id) === true,
      );
      const known = questions.filter((q) => knownAnswer(answers[q.id]));
      return {
        pillar,
        questions,
        total: questions.length,
        answered: known.length,
        assumed: known.filter((q) => assumedQuestionIds.has(q.id)).length,
      };
    });
}
