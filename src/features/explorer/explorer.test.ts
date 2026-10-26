import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import {
  belongsTo,
  createLensMembership,
  filterCapabilities,
  lensGroups,
  LENSES,
  readExplorerState,
} from './explorer.ts';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';

const membership = createLensMembership(content);

describe('explorer state and filtering', () => {
  it('defaults to the complete table without reporting an error', () => {
    const state = readExplorerState(new URLSearchParams(), content);
    expect(state).toEqual({
      lens: 'pillar',
      view: 'table',
      group: '',
      query: '',
      compare: [],
      invalid: false,
    });
    expect(filterCapabilities(content.capabilities, state, membership)).toEqual(
      content.capabilities,
    );
  });

  it('restores every setting from a shareable URL', () => {
    const state = readExplorerState(
      new URLSearchParams('lens=layer&group=data&view=cards&q=content&compare=purview-dlp'),
      content,
    );
    expect(state).toMatchObject({
      lens: 'layer',
      group: 'data',
      view: 'cards',
      query: 'content',
      compare: ['purview-dlp'],
      invalid: false,
    });
    const results = filterCapabilities(content.capabilities, state, membership);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.controlPoints.includes('data'))).toBe(true);
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
    expect(
      filterCapabilities(
        [c],
        {
          query: ' DISTINCTIVE   unique-synonym ',
          lens: 'pillar',
          group: '',
        },
        membership,
      ),
    ).toEqual([c]);
    expect(
      filterCapabilities(
        [c],
        { query: 'no-matching-phrase', lens: 'pillar', group: '' },
        membership,
      ),
    ).toEqual([]);
  });

  it.each([
    'lens=unknown',
    'view=unknown',
    'lens=pillar&group=data',
    'compare=does-not-exist',
    'compare=purview-dlp&compare=purview-dlp',
    'lens=pillar&lens=layer',
  ])('reports invalid URL settings rather than silently accepting them: %s', (query) => {
    expect(readExplorerState(new URLSearchParams(query), content).invalid).toBe(true);
  });

  it('limits deep-linked comparisons to four known, distinct capabilities', () => {
    const params = new URLSearchParams();
    content.capabilities.slice(0, 5).forEach((c) => params.append('compare', c.id));
    const state = readExplorerState(params, content);
    expect(state.compare).toEqual(content.capabilities.slice(0, 4).map((c) => c.id));
    expect(state.invalid).toBe(true);
  });
});
