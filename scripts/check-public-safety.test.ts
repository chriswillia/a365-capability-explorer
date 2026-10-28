import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkPublicSafety,
  findInText,
  loadConfig,
  verifiedAkaMs,
  type Finding,
} from './check-public-safety.ts';

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig(join(here, 'public-safety.config.json'));
const kinds = (findings: Finding[]) => findings.map((finding) => finding.kind);
const scan = (text: string, akaMs: string[] = []) =>
  findInText('fixture.md', text, config, new Set(akaMs));

describe('blocked phrases', () => {
  it.each([
    'Microsoft Confidential',
    'For INTERNAL USE ONLY',
    'Please do not share this deck',
    'Do not forward outside the team',
    'Covered by NDA until launch',
    'This roadmap is under NDA',
    'Not for external distribution',
  ])('rejects "%s"', (text) => {
    expect(kinds(scan(text))).toEqual(['phrase']);
  });

  it('does not reject the name of a sensitivity label', () => {
    expect(
      scan('Apply the Confidential label, or Highly Confidential for regulated data.'),
    ).toEqual([]);
  });

  it('reports the line and the text it matched', () => {
    expect(scan('A clean line.\nMicrosoft Confidential — draft')).toEqual([
      { file: 'fixture.md', line: 2, kind: 'phrase', match: 'Microsoft Confidential' },
    ]);
  });
});

describe('blocked hosts', () => {
  it.each([
    'https://contoso-my.sharepoint.com/personal/someone/Documents/deck.pptx',
    'https://microsoft.sharepoint.com/sites/team',
    'https://teams.microsoft.com/l/meetup-join/abc',
    'https://app.powerbi.com/groups/me/reports/1',
    'https://contoso.service-now.com/incident',
    'https://onedrive.live.com/?id=1',
    'https://1drv.ms/p/abc',
  ])('rejects a link to %s', (url) => {
    expect(kinds(scan(`See ${url} for the numbers.`))).toEqual(['host']);
  });

  it('rejects a bare host name with no scheme', () => {
    expect(kinds(scan('Open microsoft.sharepoint.com/sites/team.'))).toEqual(['host']);
  });

  it('does not reject public Microsoft sites, or a host that only contains a blocked name', () => {
    expect(
      scan(
        'https://learn.microsoft.com/en-us/microsoft-agent-365/ https://www.microsoft.com/licensing and notsharepoint.com',
      ),
    ).toEqual([]);
  });
});

describe('aka.ms links', () => {
  const sources = `
- id: verified
  url: "https://aka.ms/verified-link"
  lastVerified: "2026-10-27"
- id: unverified
  url: "https://aka.ms/unverified-link"
  lastVerified: null
- id: ordinary
  url: "https://learn.microsoft.com/en-us/microsoft-agent-365/"
  lastVerified: "2026-10-27"
`;

  it('allows only the short links that sources.yaml lists with a verified date', () => {
    const allowed = [...verifiedAkaMs(sources)];
    expect(allowed).toEqual(['aka.ms/verified-link']);
    expect(scan('https://aka.ms/verified-link', allowed)).toEqual([]);
    expect(scan('https://aka.ms/Verified-Link/', allowed)).toEqual([]);
    expect(kinds(scan('https://aka.ms/unverified-link', allowed))).toEqual(['aka.ms']);
    expect(kinds(scan('Use aka.ms/something-else', allowed))).toEqual(['aka.ms']);
  });

  it('rejects every short link when there is no sources file', () => {
    expect(verifiedAkaMs(null).size).toBe(0);
    expect(kinds(scan('https://aka.ms/anything'))).toEqual(['aka.ms']);
  });
});

describe('email addresses', () => {
  it('rejects a real-looking address', () => {
    expect(kinds(scan('Write to someone@contoso-corp.com for help.'))).toEqual(['email']);
  });

  it('allows the reserved example domains', () => {
    expect(
      scan('feedback@example.invalid, a@example.com and b@mail.example.org are placeholders.'),
    ).toEqual([]);
  });

  it('does not mistake an @-rule or a scoped package for an address', () => {
    expect(scan('@media print { } import x from "@fluentui/react-components"')).toEqual([]);
  });
});

describe('scanning folders', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'public-safety-'));
    const put = (path: string, text: string) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    put('content/bad.yaml', 'text: "Microsoft Confidential"\n');
    put(
      'content/sources.yaml',
      '- id: a\n  url: "https://aka.ms/ok"\n  lastVerified: "2026-10-27"\n',
    );
    put('content/clean.yaml', 'text: "A public statement."\n');
    put('content/picture.png', 'Microsoft Confidential');
    put('src/generated/compiled.json', '{"text":"Microsoft Confidential"}');
    put('src/app.ts', 'export const link = "https://aka.ms/ok";\n');
    put('docs/brief.md', 'Never commit anything marked Microsoft Confidential.\n');
    put('dist/assets/app.js', 'const x="https://teams.microsoft.com/l/meetup-join/1";\n');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('finds a problem in content and in the built site', () => {
    const { findings } = checkPublicSafety(root, config);
    expect(findings.map((finding) => `${finding.file}:${finding.kind}`).sort()).toEqual([
      'content/bad.yaml:phrase',
      'dist/assets/app.js:host',
    ]);
  });

  it('skips docs, compiled output and file types it does not read', () => {
    const { findings, filesScanned } = checkPublicSafety(root, config);
    expect(findings.some((finding) => finding.file.startsWith('docs/'))).toBe(false);
    expect(findings.some((finding) => finding.file.startsWith('src/generated/'))).toBe(false);
    expect(findings.some((finding) => finding.file.endsWith('.png'))).toBe(false);
    // bad.yaml, sources.yaml, clean.yaml, app.ts and app.js
    expect(filesScanned).toBe(5);
  });

  it('scans only the folders it is told to', () => {
    const { findings } = checkPublicSafety(root, config, ['src']);
    expect(findings).toEqual([]);
  });

  it('ignores a folder that does not exist', () => {
    expect(checkPublicSafety(root, config, ['dist-root']).filesScanned).toBe(0);
  });
});

describe('this repository', () => {
  it('has nothing the guard rejects in its content, source or static files', () => {
    const root = join(here, '..');
    const { findings, filesScanned } = checkPublicSafety(root, config, [
      'content',
      'src',
      'public',
    ]);
    expect(filesScanned).toBeGreaterThan(100);
    expect(findings).toEqual([]);
  });
});
