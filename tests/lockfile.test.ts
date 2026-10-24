import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findProblems, type Lockfile } from '../scripts/lockfile.ts';

const lock = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package-lock.json', import.meta.url)), 'utf8'),
) as Lockfile;

/*
 * This repository is public. A lockfile written through a private npm proxy would publish that proxy's
 * hostname and break installs and Dependabot for everyone else.
 */
describe('package-lock.json', () => {
  it('resolves every package from the public npm registry (run "npm run lockfile:fix" if this fails)', () => {
    expect(findProblems(lock)).toEqual([]);
  });

  it('pins an integrity checksum for every package', () => {
    const missing = Object.entries(lock.packages ?? {})
      .filter(
        ([path, entry]) => path !== '' && entry.link !== true && entry.integrity === undefined,
      )
      .map(([path]) => path);
    expect(missing).toEqual([]);
  });
});
