import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTENT_FILES } from '../src/lib/content/schemas.ts';
import { buildContent, parseChangelog } from './build-content.ts';

const realContent = fileURLToPath(new URL('../content', import.meta.url));
let work: string;
let contentDir: string;
let outDir: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'a365-build-'));
  contentDir = join(work, 'content');
  outDir = join(work, 'generated');
  cpSync(realContent, contentDir, { recursive: true });
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

const edit = (file: string, change: (text: string) => string) => {
  const path = join(contentDir, file);
  writeFileSync(path, change(readFileSync(path, 'utf8')));
};
const run = () => buildContent({ contentDir, outDir });

describe('buildContent', () => {
  it('compiles valid content and writes one JSON file per content file plus meta.json', () => {
    const result = run();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(readdirSync(outDir).sort()).toEqual(
      [...Object.keys(CONTENT_FILES), 'changelog', 'meta'].map((name) => `${name}.json`).sort(),
    );
  });

  it('writes JSON that parses against the same schemas', () => {
    run();
    for (const [key, { schema }] of Object.entries(CONTENT_FILES)) {
      const data = JSON.parse(readFileSync(join(outDir, `${key}.json`), 'utf8'));
      expect(schema.safeParse(data).success, key).toBe(true);
    }
  });

  it('stamps contentVersion as the newest changelog date plus a short hash', () => {
    writeFileSync(
      join(contentDir, 'changelog.md'),
      '# Changelog\n\n## 2026-10-23 · Newer entry\n\naffects: [all]\n\nNewer.\n\n## 2026-10-22 · Older entry\n\naffects: [all]\n\nOlder.\n',
    );
    expect(run().contentVersion).toMatch(/^2026\.10\.23-[0-9a-f]{7}$/);
    expect(JSON.parse(readFileSync(join(outDir, 'meta.json'), 'utf8'))).toEqual({
      contentVersion: run().contentVersion,
      schemaVersion: 1,
    });
  });

  it('gives the same version on every build and with Windows line endings', () => {
    const files = readdirSync(contentDir);
    for (const name of files) edit(name, (t) => t.replace(/\r\n/g, '\n'));
    const lf = run().contentVersion;
    expect(run().contentVersion).toBe(lf);

    for (const name of files) edit(name, (t) => t.replace(/\n/g, '\r\n'));
    expect(run().contentVersion).toBe(lf);
  });

  it('changes the version when content changes', () => {
    const first = run().contentVersion;
    edit('capabilities.yaml', (t) => `${t}\n# a new comment\n`);
    expect(run().contentVersion).not.toBe(first);
  });

  it('fails, and writes nothing, when a capability is missing its feature text', () => {
    edit('capabilities.yaml', (t) =>
      t.replace(/ {4}featureText: "Inventory of agents[^\n]*\n/, '    featureText: ""\n'),
    );
    const result = run();
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/registry-inventory › source\.featureText/);
    expect(existsSync(outDir)).toBe(false);
  });

  it('fails on a key it does not recognize', () => {
    edit('capabilities.yaml', (t) =>
      t.replace('  summary: "Lists the agents', '  sumary: "Lists the agents'),
    );
    expect(run().errors.join('\n')).toMatch(/Unrecognized key/);
  });

  it('fails on a reference to an unknown source', () => {
    edit('capabilities.yaml', (t) =>
      t.replace('sourceId: a365-registry', 'sourceId: a365-registy'),
    );
    expect(run().errors.join('\n')).toMatch(/unknown source "a365-registy"/);
  });

  it('reports malformed YAML against its file', () => {
    edit('lifecycle.yaml', (t) => `${t}\n  - bad: [unclosed\n`);
    expect(run().errors.join('\n')).toMatch(/lifecycle\.yaml/);
  });

  it('reports a missing file', () => {
    rmSync(join(contentDir, 'pillars.yaml'));
    expect(run().errors.join('\n')).toMatch(/pillars\.yaml: file not found/);
  });

  it('fails when the changelog entry is malformed', () => {
    edit('changelog.md', (t) => t.replace('affects: [all]', 'nothing here'));
    expect(run().errors.join('\n')).toMatch(/must be "affects:/);
  });
});

describe('parseChangelog', () => {
  it('reads dated entries with their affects list and body', () => {
    const { entries, errors } = parseChangelog(
      '# Changelog\n\n## 2026-10-23 · First\naffects: [purview-dlp, purview-labels]\n\nBody text.\n\n## 2026-09-01 - Older\naffects: [all]\n',
    );
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      {
        date: '2026-10-23',
        title: 'First',
        affects: ['purview-dlp', 'purview-labels'],
        body: 'Body text.',
      },
      { date: '2026-09-01', title: 'Older', affects: ['all'], body: '' },
    ]);
  });

  it('rejects a level-two heading that is not a dated entry', () => {
    expect(parseChangelog('## Not dated\n').errors.join('\n')).toMatch(/unrecognized heading/);
  });
});
