import { renderTemplate } from '../content/template.ts';

export type ReadinessStatus = 'ready' | 'gap' | 'unknown';

export interface ReadinessCounts {
  ready: number;
  gap: number;
  unknown: number;
}

export function countReadiness(checks: readonly { status: ReadinessStatus }[]): ReadinessCounts {
  const counts: ReadinessCounts = { ready: 0, gap: 0, unknown: 0 };
  for (const check of checks) counts[check.status] += 1;
  return counts;
}

/** True once at least one check has been decided, either way. Until then there is nothing to report. */
export const isAssessed = (counts: ReadinessCounts): boolean => counts.ready + counts.gap > 0;

/** "3 confirmed · 1 gap · 2 to confirm", or "Not assessed yet" while no check is decided. Never a bare 0%. */
export function describeReadiness(
  counts: ReadinessCounts,
  copy: { readinessSummary: string; readinessNotAssessed: string },
): string {
  return isAssessed(counts)
    ? renderTemplate(copy.readinessSummary, { ...counts })
    : copy.readinessNotAssessed;
}
