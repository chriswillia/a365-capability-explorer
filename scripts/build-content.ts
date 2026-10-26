import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CORE_SCHEMA, load } from 'js-yaml';
import type { ZodError } from 'zod';
import {
  CONTENT_FILES,
  ChangelogEntrySchema,
  type ChangelogEntry,
  type Content,
  type ContentMeta,
} from '../src/lib/content/schemas.ts';
import { validateContent, type ValidationOptions } from '../src/lib/content/validate.ts';

/*
 * content:build. Validates /content, then compiles it to src/generated/*.json stamped with contentVersion.
 * Runs before dev, build and test, so invalid content never reaches the app or a deploy.
 */

export interface BuildOptions {
  contentDir: string;
  outDir: string;
  /** Skip writing files (for tests that only inspect errors). */
  write?: boolean;
  validation?: ValidationOptions;
}

export interface BuildResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  contentVersion: string | null;
  counts: Record<string, number>;
}

const CHANGELOG_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*[·\-–—]\s*(.+?)\s*$/;

function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const relative = prefix === '' ? name : `${prefix}/${name}`;
    return statSync(join(dir, name)).isDirectory()
      ? listFiles(join(dir, name), relative)
      : [relative];
  });
}

/** Seven hex characters of a hash over every content file. Line endings are normalized so Windows and Linux agree. */
function hashContent(contentDir: string): string {
  const hash = createHash('sha256');
  for (const file of listFiles(contentDir).sort()) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(join(contentDir, file), 'utf8').replace(/\r\n/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 7);
}

function readYaml(path: string, label: string, errors: string[]): unknown {
  if (!existsSync(path)) {
    errors.push(`${label}: file not found`);
    return undefined;
  }
  try {
    return load(readFileSync(path, 'utf8'), { schema: CORE_SCHEMA, filename: label });
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function formatIssues(file: string, data: unknown, issues: ZodError['issues']): string[] {
  return issues.map((issue) => {
    const [first, ...rest] = issue.path;
    let where = file;
    let path = issue.path.map(String);
    if (Array.isArray(data) && typeof first === 'number') {
      const item = data[first] as { id?: unknown } | undefined;
      where = `${file} › ${typeof item?.id === 'string' ? item.id : `entry ${first + 1}`}`;
      path = rest.map(String);
    }
    return `${where}${path.length > 0 ? ` › ${path.join('.')}` : ''}: ${issue.message}`;
  });
}

/** Parses content/changelog.md. Exported for tests. */
export function parseChangelog(markdown: string): { entries: unknown[]; errors: string[] } {
  const errors: string[] = [];
  const entries: unknown[] = [];
  const sections: { date: string; title: string; lines: string[] }[] = [];

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = CHANGELOG_HEADING.exec(line);
    if (heading)
      sections.push({ date: heading[1] as string, title: heading[2] as string, lines: [] });
    else if (/^##\s/.test(line))
      errors.push(`changelog.md: unrecognized heading "${line}" (use "## YYYY-MM-DD · Title")`);
    else sections.at(-1)?.lines.push(line);
  }

  for (const section of sections) {
    const label = `changelog.md › ${section.date} "${section.title}"`;
    const lines = [...section.lines];
    while (lines.length > 0 && (lines[0] as string).trim() === '') lines.shift();
    const affectsMatch = /^affects:\s*(.+)$/.exec((lines.shift() ?? '').trim());
    if (!affectsMatch) {
      errors.push(
        `${label}: the first line after the heading must be "affects: [capability-id, ...]"`,
      );
      continue;
    }
    let affects: unknown;
    try {
      affects = load(affectsMatch[1] as string, { schema: CORE_SCHEMA });
    } catch {
      errors.push(`${label}: could not read the affects list`);
      continue;
    }
    entries.push({
      date: section.date,
      title: section.title,
      affects,
      body: lines.join('\n').trim(),
    });
  }
  return { entries, errors };
}

export function buildContent(options: BuildOptions): BuildResult {
  const { contentDir, outDir, write = true } = options;
  const errors: string[] = [];
  const parsed: Record<string, unknown> = {};

  for (const [key, { file, schema }] of Object.entries(CONTENT_FILES)) {
    const raw = readYaml(join(contentDir, file), file, errors);
    if (raw === undefined) continue;
    const result = schema.safeParse(raw);
    if (result.success) parsed[key] = result.data;
    else errors.push(...formatIssues(file, raw, result.error.issues));
  }

  const changelogPath = join(contentDir, 'changelog.md');
  const changelog: ChangelogEntry[] = [];
  if (existsSync(changelogPath)) {
    const { entries, errors: changelogErrors } = parseChangelog(
      readFileSync(changelogPath, 'utf8'),
    );
    errors.push(...changelogErrors);
    for (const entry of entries) {
      const result = ChangelogEntrySchema.safeParse(entry);
      if (result.success) {
        changelog.push(result.data);
      } else {
        const { date, title } = entry as { date: string; title: string };
        for (const issue of result.error.issues) {
          errors.push(
            `changelog.md › ${date} "${title}" › ${issue.path.map(String).join('.')}: ${issue.message}`,
          );
        }
      }
    }
  } else {
    errors.push('changelog.md: file not found');
  }

  const counts: Record<string, number> = {};
  let warnings: string[] = [];
  let contentVersion: string | null = null;

  if (errors.length === 0) {
    const content = { ...parsed, changelog } as unknown as Content;
    const validation = validateContent(content, {
      failOnOrphanedSources: true,
      ...options.validation,
    });
    errors.push(...validation.errors);
    warnings = validation.warnings;

    const newest = changelog
      .map((entry) => entry.date)
      .sort()
      .at(-1) as string;
    contentVersion = `${newest.replaceAll('-', '.')}-${hashContent(contentDir)}`;

    for (const [key, value] of Object.entries(content)) {
      if (Array.isArray(value)) counts[key] = value.length;
    }

    if (errors.length === 0 && write) {
      mkdirSync(outDir, { recursive: true });
      for (const name of readdirSync(outDir)) {
        if (name.endsWith('.json')) rmSync(join(outDir, name));
      }
      for (const [key, value] of Object.entries(content)) {
        writeFileSync(join(outDir, `${key}.json`), JSON.stringify(value));
      }
      const meta: ContentMeta = { contentVersion, schemaVersion: 1 };
      writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    contentVersion: errors.length === 0 ? contentVersion : null,
    counts,
  };
}

function main(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = buildContent({
    contentDir: join(root, 'content'),
    outDir: join(root, 'src', 'generated'),
  });

  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`error: ${error}`);
    console.error(`\ncontent:build failed with ${result.errors.length} error(s).`);
    process.exit(1);
  }
  const summary = Object.entries(result.counts)
    .map(([key, count]) => `${count} ${key}`)
    .join(', ');
  console.log(`content:build ok: ${summary}. Version ${result.contentVersion}.`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
