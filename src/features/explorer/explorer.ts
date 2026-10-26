import type { Capability, Content } from '../../lib/content/schemas.ts';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';

export const LENSES = ['pillar', 'console', 'layer', 'lifecycle', 'risk', 'pattern'] as const;
export const VIEWS = ['table', 'cards', 'matrix'] as const;
export const MAX_COMPARE = 4;
export type Lens = (typeof LENSES)[number];
export type ExplorerView = (typeof VIEWS)[number];
export interface LensMembership {
  risk: Map<string, Set<string>>;
  pattern: Map<string, Set<string>>;
}

export function createLensMembership(data: Content): LensMembership {
  return {
    risk: new Map(data.risks.map((r) => [r.id, new Set(r.mitigatedBy)])),
    pattern: new Map(
      evaluatePatterns(data, 'catalog').map(({ pattern, result }) => [
        pattern.id,
        new Set(result.inScope.map((r) => r.capability.id)),
      ]),
    ),
  };
}

export function lensGroups(content: Content, lens: Lens): { id: string; label: string }[] {
  switch (lens) {
    case 'pillar':
      return content.pillars.map((p) => ({ id: p.id, label: p.label }));
    case 'console':
      return content.consoles.map((c) => ({ id: c.id, label: c.displayName }));
    case 'layer':
      return content.controlPoints.map((p) => ({ id: p.id, label: p.layer }));
    case 'lifecycle':
      return content.lifecycle.map((s) => ({ id: s.id, label: s.label }));
    case 'risk':
      return content.risks.map((r) => ({ id: r.id, label: r.title }));
    case 'pattern':
      return content.patterns.map((p) => ({ id: p.id, label: p.title }));
  }
}

export function belongsTo(
  capability: Capability,
  lens: Lens,
  id: string,
  membership: LensMembership,
): boolean {
  switch (lens) {
    case 'pillar':
      return capability.pillar === id;
    case 'console':
      return capability.source.console === id;
    case 'layer':
      return capability.controlPoints.some((point) => point === id);
    case 'lifecycle':
      return capability.lifecycleStages.some((stage) => stage === id);
    case 'risk':
    case 'pattern':
      return membership[lens].get(id)?.has(capability.id) === true;
  }
}

export function readExplorerState(params: URLSearchParams, content: Content) {
  const rawLens = params.get('lens');
  const lens = LENSES.find((value) => value === rawLens) ?? 'pillar';
  const rawView = params.get('view');
  const view = VIEWS.find((value) => value === rawView) ?? 'table';
  const rawGroup = params.get('group') ?? '';
  const group = lensGroups(content, lens).some((item) => item.id === rawGroup) ? rawGroup : '';
  const ids = new Set(content.capabilities.map((c) => c.id));
  const rawCompare = params.getAll('compare');
  const compare = [...new Set(rawCompare.filter((id) => ids.has(id)))].slice(0, MAX_COMPARE);
  return {
    lens,
    view,
    group,
    query: params.get('q') ?? '',
    compare,
    invalid:
      (rawLens !== null && rawLens !== lens) ||
      (rawView !== null && rawView !== view) ||
      rawGroup !== group ||
      compare.length !== rawCompare.length ||
      ['lens', 'view', 'group', 'q'].some((key) => params.getAll(key).length > 1),
  };
}

export function filterCapabilities(
  capabilities: Capability[],
  state: { query: string; lens: Lens; group: string },
  membership: LensMembership,
): Capability[] {
  const terms = state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return capabilities.filter((c) => {
    if (state.group !== '' && !belongsTo(c, state.lens, state.group, membership)) return false;
    const searchable = [
      c.id,
      c.shortName,
      c.summary,
      c.executiveValue,
      c.source.featureText,
      c.source.console,
      c.ownerTeam,
      ...(c.tags ?? []),
      ...(c.questionsItAnswers ?? []),
      ...(c.discoveryQuestions ?? []),
    ]
      .join(' ')
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
