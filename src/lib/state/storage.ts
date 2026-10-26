/*
 * Everything the site keeps in the browser goes through here, under one key prefix.
 * Project sites under the same github.io account share one origin, so the prefix is distinctive.
 * The Privacy page lists what is stored; storage.test.ts keeps the two in step.
 */
export const STORAGE_PREFIX = 'cpcompass:';

export type StorageFailure = 'unavailable' | 'quota';
export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: StorageFailure };

function storageFailure(error: unknown): StorageFailure {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
    ? 'quota'
    : 'unavailable';
}

export function tryReadStored(key: string): StorageResult<string | null> {
  try {
    return { ok: true, value: window.localStorage.getItem(STORAGE_PREFIX + key) };
  } catch (error) {
    return { ok: false, error: storageFailure(error) };
  }
}

export function tryWriteStored(key: string, value: string): StorageResult<void> {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, value);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: storageFailure(error) };
  }
}

export function tryRemoveStored(key: string): StorageResult<void> {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: storageFailure(error) };
  }
}

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
