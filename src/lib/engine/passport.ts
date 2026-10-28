import { accessModelLabel } from '../content/access-fit.ts';
import { platformFor } from '../content/fit.ts';
import { populationViews, type PopulationView } from '../content/licensing.ts';
import {
  baselineRequirements,
  capabilityRequirements,
  summarizeStatuses,
  type RequirementItemView,
  type RequirementStatus,
} from '../content/requirements.ts';
import type { Answers, Content, PillarDef, Risk } from '../content/schemas.ts';
import { patternsFor } from './access.ts';
import { knownAnswer } from './answers.ts';
import { evaluateAssessment, type AssessmentAnswers, type InScope } from './evaluate.ts';

/** What the three plain questions about how an agent acts add up to. */
export type AccessHelperOutcome =
  'delegated' | 'own-teammate' | 'own-background' | 'mixed' | 'unclear';

export interface AccessHelperInput {
  /** Does it ever act for a person, using that person's access? */
  actsForPerson: boolean | null;
  /** Does it ever run on a schedule or an event, with no person present? */
  runsAlone: boolean | null;
  /** Does it have its own account, mailbox or identity? */
  ownAccount: boolean | null;
}

/**
 * Settles the accessModel question from three yes/no questions. It acts as itself when it runs alone or has its
 * own account. Doing both that and acting for a person is mixed. Null until all three are answered.
 */
export function classifyAccess(input: AccessHelperInput): AccessHelperOutcome | null {
  const { actsForPerson, runsAlone, ownAccount } = input;
  if (actsForPerson === null || runsAlone === null || ownAccount === null) return null;
  const actsAsItself = runsAlone || ownAccount;
  if (actsForPerson && actsAsItself) return 'mixed';
  if (actsForPerson) return 'delegated';
  if (ownAccount) return 'own-teammate';
  if (runsAlone) return 'own-background';
  return 'unclear';
}

export interface PassportRisk {
  risk: Risk;
  /** True when the answers say the risk applies, false when it only might. */
  certain: boolean;
  /** How many of the controls in scope for this agent address it. */
  controls: number;
}

export interface PassportArea {
  pillar: PillarDef;
  essential: InScope[];
  recommended: InScope[];
}

export interface Passport {
  /** The accessModel answer, or null while it is missing or unknown. */
  access: string | null;
  accessLabel: string | null;
  accessPatterns: ReturnType<typeof patternsFor>;
  counts: { essential: number; recommended: number; consider: number };
  /** Essential and Recommended controls by area, in the order of the areas. Empty areas are left out. */
  areas: PassportArea[];
  /** What every premium capability needs, then what the Essential controls need, each listed once. */
  requirements: RequirementItemView[];
  requirementCounts: Record<RequirementStatus, number>;
  /** The people Microsoft says to license. Empty until how the agent acts is known. */
  populations: PopulationView[];
  platform: ReturnType<typeof platformFor>;
  /** At most three, the ones this agent's controls address most. */
  risks: PassportRisk[];
  /** The questions the answers do not cover yet, as words for the customer. */
  toConfirm: string[];
  result: ReturnType<typeof evaluateAssessment>;
}

const asStrings = (value: Answers[string] | undefined): string[] | null =>
  Array.isArray(value) && value.length > 0 ? value : null;

/**
 * Everything the passport shows, computed with the same engine as the readout so the two cannot disagree.
 * It reads the answers it is given. An answer that is missing is a question to confirm, not a gap.
 */
export function buildPassport(data: Content, input: AssessmentAnswers, version: string): Passport {
  const result = evaluateAssessment(data, input, version);
  const answers: Answers = { ...input.org, ...input.useCase };
  const access =
    typeof answers.accessModel === 'string' && knownAnswer(answers.accessModel)
      ? answers.accessModel
      : null;
  const platformAnswer =
    typeof answers.buildPlatform === 'string' && knownAnswer(answers.buildPlatform)
      ? answers.buildPlatform
      : null;

  const areas = [...data.pillars]
    .sort((a, b) => a.order - b.order)
    .map((pillar): PassportArea => {
      const inArea = result.inScope.filter((entry) => entry.capability.pillar === pillar.id);
      return {
        pillar,
        essential: inArea.filter((entry) => entry.level === 'essential'),
        recommended: inArea.filter((entry) => entry.level === 'recommended'),
      };
    })
    .filter((area) => area.essential.length + area.recommended.length > 0);

  const essentialIds = new Set(
    result.inScope
      .filter((entry) => entry.level === 'essential')
      .map((entry) => entry.capability.id),
  );
  const seen = new Set<string>();
  const requirements = [
    ...baselineRequirements(data, answers),
    ...capabilityRequirements(data, answers)
      .filter((view) => essentialIds.has(view.capability.id))
      .flatMap((view) => view.items),
  ].filter((view) => {
    if (seen.has(view.item.id)) return false;
    seen.add(view.item.id);
    return true;
  });

  const ranked = (list: typeof result.risks) =>
    [...list].sort((a, b) => b.inScope.length - a.inScope.length);
  const risks: PassportRisk[] = [
    ...ranked(result.risks).map((entry) => ({
      risk: entry.risk,
      certain: true,
      controls: entry.inScope.length,
    })),
    ...ranked(result.potentialRisks).map((entry) => ({
      risk: entry.risk,
      certain: false,
      controls: entry.inScope.length,
    })),
  ].slice(0, 3);

  return {
    access,
    accessLabel: accessModelLabel(data, access),
    accessPatterns: patternsFor(data, access),
    counts: {
      essential: result.inScope.filter((entry) => entry.level === 'essential').length,
      recommended: result.inScope.filter((entry) => entry.level === 'recommended').length,
      consider: result.inScope.filter((entry) => entry.level === 'consider').length,
    },
    areas,
    requirements,
    requirementCounts: summarizeStatuses(requirements),
    populations:
      access === null
        ? []
        : populationViews(data, { access, audience: asStrings(answers.audience) }).filter(
            (view) => view.relevant !== false,
          ),
    platform: platformAnswer === null ? null : platformFor(data, platformAnswer),
    risks,
    toConfirm: result.openQuestions.map((question) => question.guidance),
    result,
  };
}
