import type { AccessPatternId, Content } from '../content/schemas.ts';
import { evaluateAssessment, type AssessmentAnswers } from './evaluate.ts';

/** The accessModel answer that stands for each way of acting when the engine asks "what if it acted this way?". */
export const PATTERN_ANSWER: Record<AccessPatternId, string> = {
  delegated: 'delegated',
  own: 'own-background',
  'agent-account': 'own-teammate',
};

const STATED_KEY = {
  delegated: 'delegated',
  own: 'own',
  'agent-account': 'agentAccount',
} as const satisfies Record<AccessPatternId, 'delegated' | 'own' | 'agentAccount'>;

/** The ways of acting an assessment's answer falls under. Empty while the answer is missing. */
export function patternsFor(data: Content, answer: unknown): AccessPatternId[] {
  if (typeof answer !== 'string') return [];
  return data.accessPatterns.patterns
    .filter((pattern) => (pattern.answers as readonly string[]).includes(answer))
    .map((pattern) => pattern.id);
}

export interface AccessChangeEntry {
  capabilityId: string;
  /**
   * Other ways of acting for which Microsoft's documentation also describes the capability, although this tool's
   * rules, which follow the service description, do not bring it into scope. Shown so a difference is not overstated.
   */
  alsoDocumented: AccessPatternId[];
}

export interface AccessChangeGroup {
  /** The ways of acting under which these capabilities are in scope, in the order the patterns are written. */
  patterns: AccessPatternId[];
  entries: AccessChangeEntry[];
}

export interface AccessChange {
  /** The ways of acting the assessment itself describes. */
  current: AccessPatternId[];
  /** Capabilities in scope under every way of acting. */
  shared: string[];
  /** Capabilities that are in scope under some ways of acting but not others, grouped by which. */
  only: AccessChangeGroup[];
  /** Whether how the agent acts changes what is in scope for this assessment. */
  differs: boolean;
}

/**
 * Recomputes the in-scope capabilities under each way of acting, with every other answer unchanged, and says what
 * differs. It uses the same engine as the readout, so this view cannot disagree with it.
 */
export function evaluateAccessChange(
  data: Content,
  input: AssessmentAnswers,
  version: string,
): AccessChange {
  const patterns = data.accessPatterns.patterns.map((pattern) => pattern.id);
  const inScope = new Map<AccessPatternId, Set<string>>(
    patterns.map((id) => [
      id,
      new Set(
        evaluateAssessment(
          data,
          { org: input.org, useCase: { ...input.useCase, accessModel: PATTERN_ANSWER[id] } },
          version,
        ).inScope.map((entry) => entry.capability.id),
      ),
    ]),
  );
  const shared: string[] = [];
  const groups = new Map<string, AccessChangeGroup>();
  for (const capability of data.capabilities) {
    const under = patterns.filter((id) => inScope.get(id)!.has(capability.id));
    if (under.length === 0) continue;
    if (under.length === patterns.length) {
      shared.push(capability.id);
      continue;
    }
    const stated = data.accessPatterns.capabilities.find((c) => c.capabilityId === capability.id);
    const alsoDocumented = patterns.filter(
      (id) =>
        !under.includes(id) && stated !== undefined && stated[STATED_KEY[id]] !== 'not-stated',
    );
    const key = under.join('|');
    const group = groups.get(key) ?? { patterns: under, entries: [] };
    group.entries.push({ capabilityId: capability.id, alsoDocumented });
    groups.set(key, group);
  }
  const only = [...groups.values()];
  return {
    current: patternsFor(data, input.useCase.accessModel),
    shared,
    only,
    differs: only.length > 0,
  };
}
