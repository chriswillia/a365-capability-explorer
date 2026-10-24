/*
 * Everything the site keeps in the browser goes through here, under one key prefix.
 * Project sites under the same github.io account share one origin, so the prefix is distinctive.
 * The Privacy page lists what is stored; storage.test.ts keeps the two in step.
 */
export const STORAGE_PREFIX = 'cpcompass:';

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null; // storage can be blocked, for example in private browsing
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // Storage is unavailable, so the choice simply won't persist.
  }
}
