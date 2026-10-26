import { describe, expect, it } from 'vitest';
import {
  CapabilitySchema,
  ConditionSchema,
  SiteSchema,
  SourceSchema,
  countWords,
} from './schemas.ts';
import { content } from './index.ts';

const capability = (overrides: Record<string, unknown> = {}) => ({
  id: 'purview-dlp',
  shortName: 'Data loss prevention for agents',
  source: {
    sourceId: 'sd-a365',
    featureText: 'Data loss prevention – block agents from accessing and sharing sensitive content',
    console: 'Purview',
    includedWithBasePlans: false,
    availableWithE7G7OrA365: true,
    gccAvailable: false,
    lastVerified: '2026-10-23',
  },
  pillar: 'secure',
  defaultWave: 2,
  controlPoints: ['data'],
  setup: 'platform',
  lifecycleStages: ['deploy', 'operate'],
  reviewStatus: 'draft',
  ...overrides,
});

describe('explorer and brief copy schemas', () => {
  it('requires all explorer and brief labels and rejects misspelled keys', () => {
    expect(SiteSchema.safeParse(content.site).success).toBe(true);
    expect(
      SiteSchema.safeParse({
        ...content.site,
        capabilities: { ...content.site.capabilities, explorer: undefined },
      }).success,
    ).toBe(false);
    expect(
      SiteSchema.safeParse({
        ...content.site,
        capabilities: {
          ...content.site.capabilities,
          brief: { ...content.site.capabilities.brief, summmary: 'typo' },
        },
      }).success,
    ).toBe(false);
  });
});

const issues = (value: unknown) => {
  const result = CapabilitySchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('CapabilitySchema', () => {
  it('accepts a minimal valid capability', () => {
    expect(issues(capability())).toEqual([]);
  });

  it('rejects keys it does not know, so a YAML typo fails the build', () => {
    expect(issues(capability({ sumary: 'typo' })).join('\n')).toMatch(/Unrecognized key/);
  });

  it('requires the verbatim feature text, source id and lastVerified', () => {
    const source = capability().source;
    expect(issues(capability({ source: { ...source, featureText: '' } })).join('\n')).toMatch(
      /source\.featureText/,
    );
    expect(issues(capability({ source: { ...source, sourceId: 'other' } })).join('\n')).toMatch(
      /source\.sourceId/,
    );
    expect(
      issues(capability({ source: { ...source, lastVerified: undefined } })).join('\n'),
    ).toMatch(/source\.lastVerified/);
  });

  it('rejects an id that is not kebab-case', () => {
    expect(issues(capability({ id: 'Purview_DLP' })).join('\n')).toMatch(/kebab-case/);
  });

  it('rejects values outside the enumerations', () => {
    expect(issues(capability({ pillar: 'protect' })).length).toBeGreaterThan(0);
    expect(issues(capability({ setup: 'someone' })).length).toBeGreaterThan(0);
    expect(issues(capability({ defaultWave: 4 })).length).toBeGreaterThan(0);
  });

  it('needs at least one control point and one lifecycle stage', () => {
    expect(issues(capability({ controlPoints: [] })).join('\n')).toMatch(/controlPoints/);
    expect(issues(capability({ lifecycleStages: [] })).join('\n')).toMatch(/lifecycleStages/);
  });

  it('rejects duplicate control points', () => {
    expect(issues(capability({ controlPoints: ['data', 'data'] })).join('\n')).toMatch(
      /duplicates/,
    );
  });

  it('enforces the word limits on editorial text', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    expect(issues(capability({ summary: words(40) }))).toEqual([]);
    expect(issues(capability({ summary: words(41) })).join('\n')).toMatch(/40 words or fewer/);
    expect(issues(capability({ executiveValue: words(31) })).join('\n')).toMatch(
      /30 words or fewer/,
    );
    expect(issues(capability({ withoutIt: words(31) })).join('\n')).toMatch(/30 words or fewer/);
    expect(issues(capability({ withIt: words(31) })).join('\n')).toMatch(/30 words or fewer/);
  });

  it('rejects dates that are not real calendar dates', () => {
    const source = capability().source;
    expect(
      issues(capability({ source: { ...source, lastVerified: '2026-02-30' } })).join('\n'),
    ).toMatch(/real calendar date/);
  });

  it('only accepts https URLs in docs', () => {
    expect(
      issues(capability({ docs: [{ title: 'Doc', url: 'http://example.com' }] })).join('\n'),
    ).toMatch(/https/);
  });
});

describe('SourceSchema', () => {
  const source = {
    id: 'lic-faq',
    title: 'Licensing FAQ',
    url: 'https://www.microsoft.com/licensing/faqs/122',
    publisher: 'Microsoft',
    lastVerified: null,
  };

  it('allows a null lastVerified, meaning "not verified yet"', () => {
    expect(SourceSchema.safeParse(source).success).toBe(true);
  });

  it('requires the lastVerified key to be present, even when empty', () => {
    const withoutKey = Object.fromEntries(
      Object.entries(source).filter(([key]) => key !== 'lastVerified'),
    );
    expect(SourceSchema.safeParse(withoutKey).success).toBe(false);
  });

  it('rejects a URL that is not https', () => {
    expect(SourceSchema.safeParse({ ...source, url: 'http://example.com' }).success).toBe(false);
  });
});

describe('ConditionSchema', () => {
  it('parses nested conditions', () => {
    const condition = {
      all: [
        { q: 'stage', in: ['pilot', 'production'] },
        {
          any: [
            { q: 'accessModel', equals: 'delegated' },
            { not: { q: 'sponsor', unknown: true } },
          ],
        },
        { always: true },
      ],
    };
    expect(ConditionSchema.safeParse(condition).success).toBe(true);
  });

  it('rejects empty groups and unknown keys', () => {
    expect(ConditionSchema.safeParse({ all: [] }).success).toBe(false);
    expect(ConditionSchema.safeParse({ q: 'stage', equalz: 'x' }).success).toBe(false);
  });

  it('rejects a question id that is not camelCase', () => {
    expect(ConditionSchema.safeParse({ q: 'Stage-Name', equals: 'x' }).success).toBe(false);
  });
});

describe('countWords', () => {
  it('counts words and ignores surrounding whitespace', () => {
    expect(countWords('  one two   three ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});
