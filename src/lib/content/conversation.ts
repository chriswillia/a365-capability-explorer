import { licensingTier, ownerTeamOf } from './derive.ts';
import type { Capability, Content, PillarDef } from './schemas.ts';

export interface RequirementGuide {
  pillar: PillarDef;
  capabilities: Capability[];
  /** Each distinct discovery question, with the capability that raises it. */
  questions: { capability: Capability; question: string }[];
  /** The owner teams of the pillar's capabilities and the product areas they configure them in. */
  people: { team: string; productAreas: string[] }[];
  total: number;
  premium: number;
  notInGcc: number;
}

const compareText = (a: string, b: string) => a.localeCompare(b, 'en');

/** The customer-conversation guide for each pillar, computed from the catalog so it never drifts from it. */
export function requirementGuides(data: Content): RequirementGuide[] {
  return [...data.pillars]
    .sort((a, b) => a.order - b.order)
    .map((pillar) => {
      const capabilities = data.capabilities.filter((c) => c.pillar === pillar.id);
      const seen = new Set<string>();
      const questions = capabilities.flatMap((capability) =>
        (capability.discoveryQuestions ?? []).flatMap((question) => {
          const key = question.trim().toLocaleLowerCase();
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ capability, question }];
        }),
      );
      const teams = new Map<string, Set<string>>();
      for (const capability of capabilities) {
        const team = ownerTeamOf(capability, data.consoles);
        const area =
          data.consoles.find((c) => c.id === capability.source.console)?.displayName ?? '';
        teams.set(team, (teams.get(team) ?? new Set()).add(area));
      }
      return {
        pillar,
        capabilities,
        questions,
        people: [...teams]
          .sort(([a], [b]) => compareText(a, b))
          .map(([team, areas]) => ({ team, productAreas: [...areas].sort(compareText) })),
        total: capabilities.length,
        premium: capabilities.filter((c) => licensingTier(c) === 'premium').length,
        notInGcc: capabilities.filter((c) => !c.source.gccAvailable).length,
      };
    });
}
