import type { Content } from './schemas.ts';

/** The platform entry that covers a build platform answer, or null when none does. */
export function platformFor(data: Content, buildPlatform: string) {
  return (
    data.fit.platforms.items.find((item) => item.buildPlatforms.includes(buildPlatform)) ?? null
  );
}

/**
 * Reads a comma-separated address parameter, keeping only known ids. "none" means everything was cleared.
 * Null means the parameter says nothing usable, so the caller picks a default.
 */
export function readList(raw: string | null, known: readonly string[]): string[] | null {
  if (raw === null) return null;
  if (raw === 'none') return [];
  const ids = raw.split(',').filter((id) => known.includes(id));
  return ids.length === 0 ? null : [...new Set(ids)];
}
