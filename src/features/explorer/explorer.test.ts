import { describe, expect, it } from 'vitest';
import { content, metrics } from '../../lib/content/index.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import {
  applyFilter,
  belongsTo,
  createLensMembership,
  explorerSearch,
  filterCapabilities,
  filterLabel,
  lensGroups,
  LENSES,
  matchShortcuts,
  readExplorerState,
  sectionGroups,
  sectionOf,
} from './explorer.ts';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';

const membership = createLensMembership(content);
const read = (query: string) => readExplorerState(new URLSearchParams(query), content);
const count = (query: string) =>
  filterCapabilities(content.capabilities, read(query), membership).length;

describe('explorer state and filtering', () => {
  it('defaults to the complete table grouped by pillar, without reporting an error', () => {
    const state = read('');
    expect(state).toEqual({
      query: '',
      pillar: '',
      console: '',
      licensing: '',
      gcc: '',
      setup: '',
      by: 'pillar',
      lens: '',
      group: '',
      view: 'table',
      compare: [],
      invalid: false,
    });
    expect(filterCapabilities(content.capabilities, state, membership)).toEqual(
      content.capabilities,
    );
  });

  it('restores every setting from a shareable URL and writes the same URL back', () => {
    const query =
      'q=content&pillar=secure&console=Purview&licensing=premium&gcc=unavailable&setup=platform&by=console&lens=layer&group=data&view=cards&compare=purview-dlp';
    const state = read(query);
    expect(state).toEqual({
      query: 'content',
      pillar: 'secure',
      console: 'Purview',
      licensing: 'premium',
      gcc: 'unavailable',
      setup: 'platform',
      by: 'console',
      lens: 'layer',
      group: 'data',
      view: 'cards',
      compare: ['purview-dlp'],
      invalid: false,
    });
    expect(Object.fromEntries(explorerSearch(state))).toEqual(
      Object.fromEntries(new URLSearchParams(query)),
    );
    const results = filterCapabilities(content.capabilities, state, membership);
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (c) =>
          c.pillar === 'secure' &&
          c.source.console === 'Purview' &&
          !c.source.includedWithBasePlans &&
          !c.source.gccAvailable &&
          c.setup === 'platform' &&
          c.controlPoints.includes('data'),
      ),
    ).toBe(true);
  });

  it('omits default settings from the URL', () => {
    expect(explorerSearch(read('by=pillar&view=table&pillar=govern')).toString()).toBe(
      'pillar=govern',
    );
  });

  it('keeps links from before the filters existed working without an error', () => {
    expect(read('lens=pillar&group=secure')).toMatchObject({
      pillar: 'secure',
      lens: '',
      invalid: false,
    });
    expect(read('lens=console&group=Entra')).toMatchObject({
      console: 'Entra',
      by: 'console',
      lens: '',
      invalid: false,
    });
    expect(read('lens=console')).toMatchObject({ by: 'console', invalid: false });
    expect(read('lens=pillar')).toMatchObject({ pillar: '', invalid: false });
  });

  it.each(LENSES)('maps the %s lens consistently with its taxonomy or generated rules', (lens) => {
    const groups = lensGroups(content, lens);
    expect(groups.length).toBeGreaterThan(0);
    if (lens === 'pattern') {
      for (const { pattern, result } of evaluatePatterns(content, 'test')) {
        expect(
          content.capabilities
            .filter((c) => belongsTo(c, lens, pattern.id, membership))
            .map((c) => c.id)
            .sort(),
        ).toEqual(result.inScope.map((r) => r.capability.id).sort());
      }
      expect(
        groups.some((group) =>
          belongsTo(
            content.capabilities.find((c) => c.id === 'registry-graph-api')!,
            lens,
            group.id,
            membership,
          ),
        ),
      ).toBe(false);
    } else
      for (const c of content.capabilities) {
        expect(groups.some((group) => belongsTo(c, lens, group.id, membership))).toBe(true);
      }
  });

  it.each(['pillar', 'console'] as const)(
    'places every capability in exactly one %s section',
    (by) => {
      const groups = sectionGroups(content, by);
      for (const c of content.capabilities)
        expect(groups.filter((group) => group.id === sectionOf(c, by))).toHaveLength(1);
      expect(
        groups.reduce(
          (sum, group) =>
            sum + content.capabilities.filter((c) => sectionOf(c, by) === group.id).length,
          0,
        ),
      ).toBe(content.capabilities.length);
    },
  );

  it('names pillar sections with the customer-facing requirement and the pillar', () => {
    expect(sectionGroups(content, 'pillar').map((group) => group.label)).toEqual([
      'Observability (Observe)',
      'Governance (Govern)',
      'Security (Secure)',
    ]);
  });

  it('includes secondary layers and lifecycle stages, not just the primary', () => {
    const c: Capability = {
      ...content.capabilities[0]!,
      controlPoints: ['registry', 'oversight'],
      lifecycleStages: ['build', 'operate'],
    };
    expect(belongsTo(c, 'layer', c.controlPoints[1]!, membership)).toBe(true);
    const stage = c.lifecycleStages.at(-1)!;
    expect(belongsTo(c, 'lifecycle', stage, membership)).toBe(true);
  });

  it('searches questions and synonyms with case-insensitive, whitespace-separated terms', () => {
    const c = {
      ...content.capabilities[0]!,
      tags: ['unique-synonym'],
      questionsItAnswers: ['A distinctive discovery question'],
    };
    const base = { ...read(''), query: '' };
    expect(
      filterCapabilities([c], { ...base, query: ' DISTINCTIVE   unique-synonym ' }, membership),
    ).toEqual([c]);
    expect(filterCapabilities([c], { ...base, query: 'no-matching-phrase' }, membership)).toEqual(
      [],
    );
  });

  it('combines filters, and each filter matches what the service description says', () => {
    expect(count('licensing=base')).toBe(metrics.foundationalCount);
    expect(count('licensing=premium')).toBe(metrics.premiumCount);
    expect(count('gcc=available')).toBe(metrics.gccCount);
    expect(count('gcc=unavailable')).toBe(metrics.notInGccCount);
    expect(count('setup=platform')).toBe(metrics.platformCount);
    expect(count('setup=agent')).toBe(metrics.agentDecisionCount);
    expect(count('pillar=secure')).toBe(metrics.secureCount);
    expect(count('console=Defender')).toBe(metrics.byConsole.Defender);
    expect(count('pillar=secure&licensing=premium')).toBeLessThanOrEqual(
      Math.min(count('pillar=secure'), count('licensing=premium')),
    );
  });

  it('keeps every number on the Overview linked to exactly what it counts', () => {
    for (const kpi of content.site.overview.kpis) {
      const state = read(kpi.href.split('?')[1] ?? '');
      expect(state.invalid).toBe(false);
      expect(filterCapabilities(content.capabilities, state, membership)).toHaveLength(
        metrics[kpi.valueKey],
      );
      if (kpi.noteHref !== undefined) {
        const note = read(kpi.noteHref.split('?')[1] ?? '');
        expect(note.invalid).toBe(false);
        expect(filterCapabilities(content.capabilities, note, membership)).toHaveLength(
          metrics.notInGccCount,
        );
      }
    }
  });

  it('points every capability path in a persona link at valid explorer settings', () => {
    for (const persona of content.personas) {
      if (!persona.href.startsWith('/capabilities')) continue;
      expect(read(persona.href.split('?')[1] ?? '').invalid).toBe(false);
    }
  });

  it.each([
    'lens=unknown',
    'view=unknown',
    'pillar=nonsense',
    'console=Nonsense',
    'licensing=free',
    'gcc=maybe',
    'setup=sometimes',
    'by=region',
    'group=data',
    'lens=layer&group=nonsense',
    'lens=pillar&group=data',
    'compare=does-not-exist',
    'compare=purview-dlp&compare=purview-dlp',
    'lens=layer&lens=risk',
    'pillar=secure&pillar=govern',
  ])('reports invalid URL settings rather than silently accepting them: %s', (query) => {
    expect(read(query).invalid).toBe(true);
  });

  it('limits deep-linked comparisons to four known, distinct capabilities', () => {
    const params = new URLSearchParams();
    content.capabilities.slice(0, 5).forEach((c) => params.append('compare', c.id));
    const state = readExplorerState(params, content);
    expect(state.compare).toEqual(content.capabilities.slice(0, 4).map((c) => c.id));
    expect(state.invalid).toBe(true);
  });
});

describe('search shortcuts', () => {
  const shortcuts = content.site.capabilities.shortcuts;
  const ids = (query: string) => matchShortcuts(query, shortcuts).map((shortcut) => shortcut.id);

  it('offers the requirement area when a seller searches for it by name', () => {
    expect(ids('security')).toEqual(['security']);
    expect(ids('Governance requirements')).toEqual(['governance']);
    expect(ids('observability')).toEqual(['observability']);
  });

  it('offers filters for words the catalog does not contain', () => {
    expect(ids('SIEM')).toEqual(['oversight-layer']);
    expect(ids('logging')).toEqual(['oversight-layer']);
    expect(ids('E7')).toEqual(['premium']);
    expect(ids('license')).toEqual(['premium', 'base']);
    expect(ids('GCC')).toEqual(['gcc-available', 'gcc-unavailable']);
  });

  it('matches whole words only and offers nothing for unrelated text', () => {
    expect(ids('insecurity')).toEqual([]);
    expect(ids('blueprint')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it('applies a filter to the current settings and clears the search', () => {
    const state = applyFilter(read('q=siem&licensing=premium'), { pillar: 'secure' });
    expect(state).toMatchObject({ query: '', pillar: 'secure', licensing: 'premium' });
    expect(applyFilter(state, { lens: 'layer', group: 'oversight' })).toMatchObject({
      lens: 'layer',
      group: 'oversight',
      pillar: 'secure',
    });
  });

  it('only offers filters that lead somewhere and describe them in plain words', () => {
    for (const shortcut of shortcuts) {
      const next = applyFilter(read(''), shortcut.filter);
      expect(filterCapabilities(content.capabilities, next, membership).length).toBeGreaterThan(0);
      expect(filterLabel(content, shortcut.filter)).not.toBe('');
    }
    expect(filterLabel(content, { pillar: 'secure' })).toBe('Security (Secure)');
    expect(filterLabel(content, { licensing: 'premium' })).toBe(
      'Requires Microsoft 365 E7/G7 or Agent 365',
    );
  });
});
