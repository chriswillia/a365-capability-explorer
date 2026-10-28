import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CORE_SCHEMA, load } from 'js-yaml';

/*
 * The public-safety guard. This site is public, so nothing that looks like internal Microsoft material may be
 * committed or built. It scans the content, the source, the static files and the built site, and fails on:
 *   - a blocked phrase, such as a confidentiality marking or NDA wording
 *   - a link to a blocked host, such as an internal SharePoint, BI, ticketing or Teams address
 *   - an aka.ms link that sources.yaml does not list with a verified date
 *   - an email address
 * Run it with `npm run check:public`, or name the folders to scan. docs/ and its own config file are not
 * scanned, so a brief that describes these rules does not trip it.
 */

export interface SafetyConfig {
  scan: string[];
  skip: string[];
  extensions: string[];
  blockedPhrases: string[];
  blockedHosts: string[];
  allowedEmailDomains: string[];
}

export type FindingKind = 'phrase' | 'host' | 'aka.ms' | 'email';

export interface Finding {
  file: string;
  line: number;
  kind: FindingKind;
  match: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = (values: string[]) => values.map(escapeRegExp).join('|');

/** `aka.ms/path`, lower case and without a trailing slash, so a link compares the same however it is written. */
function akaMsKey(value: string): string {
  return value.toLowerCase().replace(/[/.,;:]+$/, '');
}

/** The aka.ms links that sources.yaml lists with a verified date. Any other short link may point anywhere. */
export function verifiedAkaMs(sourcesYaml: string | null): Set<string> {
  const allowed = new Set<string>();
  if (sourcesYaml === null) return allowed;
  const sources = load(sourcesYaml, { schema: CORE_SCHEMA });
  if (!Array.isArray(sources)) return allowed;
  for (const source of sources as unknown[]) {
    if (typeof source !== 'object' || source === null) continue;
    const { url, lastVerified } = source as { url?: unknown; lastVerified?: unknown };
    if (typeof url !== 'string' || lastVerified === null || lastVerified === undefined) continue;
    const link = /aka\.ms\/[^\s"'<>)\]\\]*/i.exec(url)?.[0];
    if (link !== undefined) allowed.add(akaMsKey(link));
  }
  return allowed;
}

/** Everything in one file's text that the guard rejects. */
export function findInText(
  file: string,
  text: string,
  config: SafetyConfig,
  akaMs: ReadonlySet<string>,
): Finding[] {
  const findings: Finding[] = [];
  const rules: {
    kind: FindingKind;
    pattern: RegExp;
    reject: (match: RegExpExecArray) => boolean;
  }[] = [
    {
      kind: 'email',
      pattern: /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g,
      reject: (match) => {
        const domain = match[1]!.toLowerCase();
        return !config.allowedEmailDomains.some(
          (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
        );
      },
    },
    {
      kind: 'aka.ms',
      pattern: /(?<![\w.-])aka\.ms\/[^\s"'<>)\]\\`,;]*/gi,
      reject: (match) => !akaMs.has(akaMsKey(match[0])),
    },
  ];
  if (config.blockedPhrases.length > 0)
    rules.push({
      kind: 'phrase',
      pattern: new RegExp(`(?<!\\w)(?:${alternatives(config.blockedPhrases)})(?!\\w)`, 'gi'),
      reject: () => true,
    });
  if (config.blockedHosts.length > 0)
    rules.push({
      kind: 'host',
      pattern: new RegExp(
        `(?<![\\w.-])(?:[a-z0-9-]+\\.)*(?:${alternatives(config.blockedHosts)})(?![\\w-])`,
        'gi',
      ),
      reject: () => true,
    });
  text.split(/\r?\n/).forEach((lineText, index) => {
    for (const { kind, pattern, reject } of rules)
      for (const match of lineText.matchAll(pattern))
        if (reject(match))
          findings.push({ file, line: index + 1, kind, match: match[0].slice(0, 120) });
  });
  return findings;
}

function* walk(dir: string, root: string, config: SafetyConfig): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const path = relative(root, full).split(sep).join('/');
    if (config.skip.some((skipped) => path === skipped || path.startsWith(`${skipped}/`))) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full, root, config);
    else if (
      stat.size <= MAX_BYTES &&
      config.extensions.some((extension) => name.toLowerCase().endsWith(extension))
    )
      yield full;
  }
}

export interface SafetyReport {
  findings: Finding[];
  filesScanned: number;
}

/** Scans the named folders under root (by default, the ones in the config) and reports what it finds. */
export function checkPublicSafety(
  root: string,
  config: SafetyConfig,
  dirs: string[] = config.scan,
): SafetyReport {
  const sources = join(root, 'content', 'sources.yaml');
  const akaMs = verifiedAkaMs(existsSync(sources) ? readFileSync(sources, 'utf8') : null);
  const findings: Finding[] = [];
  let filesScanned = 0;
  for (const dir of dirs) {
    const base = join(root, dir);
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    for (const file of walk(base, root, config)) {
      filesScanned += 1;
      findings.push(
        ...findInText(
          relative(root, file).split(sep).join('/'),
          readFileSync(file, 'utf8'),
          config,
          akaMs,
        ),
      );
    }
  }
  return { findings, filesScanned };
}

export function loadConfig(path: string): SafetyConfig {
  return JSON.parse(readFileSync(path, 'utf8')) as SafetyConfig;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const config = loadConfig(join(root, 'scripts', 'public-safety.config.json'));
  const named = process.argv.slice(2);
  const { findings, filesScanned } = checkPublicSafety(
    root,
    config,
    named.length > 0 ? named : undefined,
  );
  if (findings.length === 0) {
    console.log(`Public-safety guard: ${filesScanned} files scanned, nothing found.`);
  } else {
    console.error(`Public-safety guard: ${findings.length} finding(s) in ${filesScanned} files.`);
    for (const finding of findings.slice(0, 50))
      console.error(`  ${finding.file}:${finding.line}  ${finding.kind}  "${finding.match}"`);
    if (findings.length > 50) console.error(`  ...and ${findings.length - 50} more.`);
    process.exitCode = 1;
  }
}
