import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { DEPTH_STORAGE_KEY } from './depth.ts';
import { DIAGNOSTIC_STORAGE_KEY } from './diagnostic-storage.ts';
import { readStored, STORAGE_PREFIX, writeStored } from './storage.ts';

describe('browser storage', () => {
  it('uses a distinctive prefix, because project sites under one github.io account share an origin', () => {
    expect(STORAGE_PREFIX).toBe('cpcompass:');
  });

  it('lists every key it writes on the Privacy page, with the real prefix', () => {
    const listed = content.site.privacy.stored.map((row) => row.where).join('\n');
    expect(listed).toContain(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`);
    expect(listed).toContain(`${STORAGE_PREFIX}${DIAGNOSTIC_STORAGE_KEY}`);
    expect(listed).toContain('react-router-scroll-positions');
  });

  it('fails quietly when storage is unavailable (this test runs where there is no window)', () => {
    expect(readStored('depth')).toBeNull();
    expect(() => writeStored('depth', 'technical')).not.toThrow();
  });
});
