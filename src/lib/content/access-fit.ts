import type { Content } from './schemas.ts';

export const ACCESS_PATTERN_KEYS = ['delegated', 'own', 'agentAccount'] as const;
export type AccessPatternKey = (typeof ACCESS_PATTERN_KEYS)[number];
type AccessRow = Content['accessPatterns']['capabilities'][number];

export type AccessFit =
  | { kind: 'differs'; row: AccessRow }
  | { kind: 'stated'; row: AccessRow; patterns: AccessPatternKey[] }
  | { kind: 'unsplit' };

/**
 * What Microsoft's documentation says about a capability by how the agent acts. It only reports what a
 * sourced statement in access-patterns.yaml says. Where Microsoft is silent the answer is "unsplit", which
 * is not the same as "the same for every pattern".
 */
export function accessFit(data: Content, capabilityId: string): AccessFit {
  const row = data.accessPatterns.capabilities.find((entry) => entry.capabilityId === capabilityId);
  if (row === undefined) return { kind: 'unsplit' };
  if (ACCESS_PATTERN_KEYS.some((key) => row[key] === 'differs')) return { kind: 'differs', row };
  const patterns = ACCESS_PATTERN_KEYS.filter((key) => row[key] === 'applies');
  return patterns.length === 0 ? { kind: 'unsplit' } : { kind: 'stated', row, patterns };
}

/** The short name of how an agent acts, from the accessModel answer. Null when it is missing or unknown. */
export function accessModelLabel(data: Content, answer: unknown): string | null {
  const labels: Record<string, string> = data.accessPatterns.answerLabels;
  return typeof answer === 'string' ? (labels[answer] ?? null) : null;
}
