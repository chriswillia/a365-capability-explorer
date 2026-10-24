import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * package-lock.json must point at the public npm registry. A machine that installs through a private proxy
 * records the proxy's URLs in the lockfile, which leaks internal hostnames into a public repository and
 * breaks installs and Dependabot for everyone else.
 *
 *   npm run lockfile:check   lists entries that do not point at registry.npmjs.org
 *   npm run lockfile:fix     rewrites them to the public registry's tarball URLs
 *
 * "fix" leaves integrity values alone, because a proxy serves the same bytes as the registry.
 */

export const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

export interface LockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  link?: boolean;
}

export interface Lockfile {
  packages?: Record<string, LockEntry>;
}

const TARBALL_URL = /^https?:\/\/[^?#]+\.tgz$/;

/** The package name for a lockfile path such as "node_modules/a/node_modules/@scope/b". */
export function packageName(path: string, entry: LockEntry): string {
  const marker = 'node_modules/';
  return entry.name ?? path.slice(path.lastIndexOf(marker) + marker.length);
}

/** The tarball URL the public registry uses for a published version. */
export function publicTarballUrl(name: string, version: string): string {
  return `${PUBLIC_REGISTRY}${name}/-/${name.slice(name.lastIndexOf('/') + 1)}-${version}.tgz`;
}

function resolvedEntries(lock: Lockfile): [string, LockEntry & { resolved: string }][] {
  const entries: [string, LockEntry & { resolved: string }][] = [];
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (path !== '' && entry.link !== true && entry.resolved !== undefined) {
      entries.push([path, { ...entry, resolved: entry.resolved }]);
    }
  }
  return entries;
}

/** One message per entry whose resolved URL is not a plain public-registry URL. */
export function findProblems(lock: Lockfile): string[] {
  const problems: string[] = [];
  for (const [path, { resolved }] of resolvedEntries(lock)) {
    // The offending address is left out on purpose, so a failing run never repeats it in a log.
    if (!resolved.startsWith(PUBLIC_REGISTRY)) {
      problems.push(`${path}: resolved does not point at ${PUBLIC_REGISTRY}`);
      continue;
    }
    const url = new URL(resolved);
    if (url.search !== '' || url.hash !== '') {
      problems.push(`${path}: resolved carries a query string or fragment`);
    }
  }
  return problems;
}

/**
 * Rewrites tarball URLs that are not on the public registry. Entries that are not plain tarball URLs
 * (git or file sources) are left for a person to look at. Returns how many entries changed.
 */
export function fixLockfile(lock: Lockfile): number {
  let changed = 0;
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const { resolved, version } = entry;
    if (path === '' || entry.link === true || resolved === undefined || version === undefined)
      continue;
    if (resolved.startsWith(PUBLIC_REGISTRY) || !TARBALL_URL.test(resolved)) continue;
    entry.resolved = publicTarballUrl(packageName(path, entry), version);
    changed += 1;
  }
  return changed;
}

function main(mode: string): number {
  if (mode !== 'check' && mode !== 'fix') {
    console.error('Usage: tsx scripts/lockfile.ts <check|fix>');
    return 2;
  }
  const path = resolve('package-lock.json');
  const lock = JSON.parse(readFileSync(path, 'utf8')) as Lockfile;

  if (mode === 'fix') {
    const changed = fixLockfile(lock);
    // npm writes lockfiles as two-space JSON with a trailing newline.
    if (changed > 0) writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`lockfile:fix rewrote ${changed} ${changed === 1 ? 'entry' : 'entries'}.`);
  }

  const problems = findProblems(lock);
  if (problems.length === 0) {
    console.log('lockfile ok: every package resolves from the public npm registry.');
    return 0;
  }
  for (const problem of problems.slice(0, 20)) console.error(`error: ${problem}`);
  if (problems.length > 20) console.error(`error: ...and ${problems.length - 20} more`);
  console.error(
    `\n${problems.length} lockfile ${problems.length === 1 ? 'entry does' : 'entries do'} not resolve from the public npm registry.`,
  );
  if (mode === 'check') console.error('Run "npm run lockfile:fix" to rewrite them.');
  return 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2] ?? 'check'));
}
