import { describe, expect, it } from 'vitest';
import {
  PUBLIC_REGISTRY,
  findProblems,
  fixLockfile,
  packageName,
  publicTarballUrl,
  type Lockfile,
} from './lockfile.ts';

// A made-up private registry. The real internal hostname must never appear in this repository.
const PRIVATE = 'https://registry.example.test/team-feed/npm/registry/';

const lockfile = (packages: NonNullable<Lockfile['packages']>): Lockfile => ({
  packages: { '': { version: '1.0.0' }, ...packages },
});

describe('publicTarballUrl', () => {
  it('builds the registry URL for an unscoped package', () => {
    expect(publicTarballUrl('react', '19.3.1')).toBe(`${PUBLIC_REGISTRY}react/-/react-19.3.1.tgz`);
  });

  it('builds the registry URL for a scoped package', () => {
    expect(publicTarballUrl('@babel/core', '7.29.7')).toBe(
      `${PUBLIC_REGISTRY}@babel/core/-/core-7.29.7.tgz`,
    );
  });
});

describe('packageName', () => {
  it('reads the name from the lockfile path', () => {
    expect(packageName('node_modules/react', {})).toBe('react');
  });

  it('handles scoped and nested installs', () => {
    expect(packageName('node_modules/@babel/core', {})).toBe('@babel/core');
    expect(packageName('node_modules/a/node_modules/@scope/b', {})).toBe('@scope/b');
  });

  it('prefers the name field, which aliased installs carry', () => {
    expect(packageName('node_modules/alias', { name: 'real-package' })).toBe('real-package');
  });
});

describe('findProblems', () => {
  it('accepts public registry URLs', () => {
    const lock = lockfile({
      'node_modules/react': { version: '19.3.1', resolved: publicTarballUrl('react', '19.3.1') },
    });
    expect(findProblems(lock)).toEqual([]);
  });

  it('flags a private registry, without repeating its address', () => {
    const lock = lockfile({
      'node_modules/react': { version: '19.3.1', resolved: `${PRIVATE}react/-/react-19.3.1.tgz` },
    });
    const problems = findProblems(lock);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('node_modules/react');
    expect(problems.join('\n')).not.toContain('example.test');
  });

  it('flags credentials in the URL, which also change its prefix', () => {
    const lock = lockfile({
      'node_modules/react': {
        version: '19.3.1',
        resolved: 'https://user:secret@registry.npmjs.org/react/-/react-19.3.1.tgz',
      },
    });
    expect(findProblems(lock)).toHaveLength(1);
  });

  it('flags a query string or fragment on a public URL', () => {
    const lock = lockfile({
      'node_modules/a': { version: '1.0.0', resolved: `${PUBLIC_REGISTRY}a/-/a-1.0.0.tgz?token=x` },
      'node_modules/b': { version: '1.0.0', resolved: `${PUBLIC_REGISTRY}b/-/b-1.0.0.tgz#frag` },
    });
    expect(findProblems(lock)).toHaveLength(2);
  });

  it('flags a source that is not a registry tarball, such as a git URL', () => {
    const lock = lockfile({
      'node_modules/git-dep': {
        version: '1.0.0',
        resolved: 'git+https://example.test/repo.git#abc123',
      },
    });
    expect(findProblems(lock)).toHaveLength(1);
  });

  it('ignores the root entry, links and entries with no resolved URL', () => {
    const lock = lockfile({
      'node_modules/linked': { link: true, resolved: 'packages/linked' },
      'node_modules/bundled': { version: '1.0.0' },
    });
    expect(findProblems(lock)).toEqual([]);
  });
});

describe('fixLockfile', () => {
  it('rewrites private-registry URLs to the public registry and keeps integrity', () => {
    const lock = lockfile({
      'node_modules/react': {
        version: '19.3.1',
        resolved: `${PRIVATE}react/-/react-19.3.1.tgz`,
        integrity: 'sha1-abc=',
      },
    });
    expect(fixLockfile(lock)).toBe(1);
    expect(lock.packages?.['node_modules/react']).toEqual({
      version: '19.3.1',
      resolved: `${PUBLIC_REGISTRY}react/-/react-19.3.1.tgz`,
      integrity: 'sha1-abc=',
    });
    expect(findProblems(lock)).toEqual([]);
  });

  it('is idempotent', () => {
    const lock = lockfile({
      'node_modules/react': { version: '19.3.1', resolved: `${PRIVATE}react/-/react-19.3.1.tgz` },
    });
    fixLockfile(lock);
    expect(fixLockfile(lock)).toBe(0);
  });

  it('leaves public entries untouched', () => {
    const resolved = `${PUBLIC_REGISTRY}react/-/react-19.3.1.tgz`;
    const lock = lockfile({ 'node_modules/react': { version: '19.3.1', resolved } });
    expect(fixLockfile(lock)).toBe(0);
    expect(lock.packages?.['node_modules/react']?.resolved).toBe(resolved);
  });

  it('handles scoped, nested and aliased packages', () => {
    const lock = lockfile({
      'node_modules/@babel/core': {
        version: '7.29.7',
        resolved: `${PRIVATE}@babel/core/-/core-7.29.7.tgz`,
      },
      'node_modules/a/node_modules/b': { version: '2.0.0', resolved: `${PRIVATE}b/-/b-2.0.0.tgz` },
      'node_modules/alias': {
        name: 'real',
        version: '3.0.0',
        resolved: `${PRIVATE}real/-/real-3.0.0.tgz`,
      },
    });
    expect(fixLockfile(lock)).toBe(3);
    expect(lock.packages?.['node_modules/@babel/core']?.resolved).toBe(
      `${PUBLIC_REGISTRY}@babel/core/-/core-7.29.7.tgz`,
    );
    expect(lock.packages?.['node_modules/a/node_modules/b']?.resolved).toBe(
      `${PUBLIC_REGISTRY}b/-/b-2.0.0.tgz`,
    );
    expect(lock.packages?.['node_modules/alias']?.resolved).toBe(
      `${PUBLIC_REGISTRY}real/-/real-3.0.0.tgz`,
    );
  });

  it('leaves git sources for a person to look at, and they still count as problems', () => {
    const resolved = 'git+https://example.test/repo.git#abc123';
    const lock = lockfile({ 'node_modules/git-dep': { version: '1.0.0', resolved } });
    expect(fixLockfile(lock)).toBe(0);
    expect(lock.packages?.['node_modules/git-dep']?.resolved).toBe(resolved);
    expect(findProblems(lock)).toHaveLength(1);
  });
});
