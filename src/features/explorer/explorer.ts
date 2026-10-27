import { licensingTier } from '../../lib/content/derive.ts';
import { pillarName } from '../../lib/content/index.ts';
import {
  CONSOLES,
  EXPLORER_LENSES,
  PILLARS,
  type Capability,
  type Content,
  type ExplorerFilter,
} from '../../lib/content/schemas.ts';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';

export const LENSES = EXPLORER_LENSES;
export const VIEWS = ['table', 'cards', 'matrix'] as const;
export const SECTIONINGS = ['pillar', 'console', 'none'] as const;
export const LICENSING_FILTERS = ['base', 'premium'] as const;
export const GCC_FILTERS = ['available', 'unavailable'] as const;
export const SETUP_FILTERS = ['platform', 'agent'] as const;
export const MAX_COMPARE = 4;
export type Lens = (typeof LENSES)[number];
export type ExplorerView = (typeof VIEWS)[number];
export type Sectioning = (typeof SECTIONINGS)[number];
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

/** The groups a table or card list is divided into. A capability belongs to exactly one of them. */
export function sectionGroups(
  content: Content,
  by: Exclude<Sectioning, 'none'>,
): { id: string; label: string }[] {
  return by === 'pillar'
    ? [...content.pillars]
        .sort((a, b) => a.order - b.order)
        .map((p) => ({ id: p.id, label: pillarName(p) }))
    : [...content.consoles]
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, label: c.displayName }));
}

export function sectionOf(capability: Capability, by: Exclude<Sectioning, 'none'>): string {
  return by === 'pillar' ? capability.pillar : capability.source.console;
}

export function belongsTo(
  capability: Capability,
  lens: Lens,
  id: string,
  membership: LensMembership,
): boolean {
  switch (lens) {
    case 'layer':
      return capability.controlPoints.some((point) => point === id);
    case 'lifecycle':
      return capability.lifecycleStages.some((stage) => stage === id);
    case 'risk':
    case 'pattern':
      return membership[lens].get(id)?.has(capability.id) === true;
  }
}

export interface ExplorerState {
  query: string;
  pillar: string;
  console: string;
  licensing: '' | (typeof LICENSING_FILTERS)[number];
  gcc: '' | (typeof GCC_FILTERS)[number];
  setup: '' | (typeof SETUP_FILTERS)[number];
  by: Sectioning;
  lens: '' | Lens;
  group: string;
  view: ExplorerView;
  compare: string[];
  invalid: boolean;
}

const SINGLE_KEYS = [
  'q',
  'pillar',
  'console',
  'licensing',
  'gcc',
  'setup',
  'by',
  'lens',
  'group',
  'view',
] as const;

export function readExplorerState(params: URLSearchParams, content: Content): ExplorerState {
  let invalid = SINGLE_KEYS.some((key) => params.getAll(key).length > 1);
  const choose = <T extends string>(key: string, allowed: readonly T[]): '' | T => {
    const raw = params.get(key);
    if (raw === null || raw === '') return '';
    const match = allowed.find((value) => value === raw);
    if (match === undefined) invalid = true;
    return match ?? '';
  };
  let pillar: string = choose('pillar', PILLARS);
  let console_: string = choose('console', CONSOLES);
  const licensing = choose('licensing', LICENSING_FILTERS);
  const gcc = choose('gcc', GCC_FILTERS);
  const setup = choose('setup', SETUP_FILTERS);
  let by: Sectioning = choose('by', SECTIONINGS) || 'pillar';
  const view = choose('view', VIEWS) || 'table';
  let lens: '' | Lens = '';
  let rawGroup = params.get('group') ?? '';
  const rawLens = params.get('lens');
  if (rawLens === 'pillar' || rawLens === 'console') {
    // Links written before the explorer had filters: a pillar or console lens with one group.
    const legacy = (rawLens === 'pillar' ? PILLARS : CONSOLES).find((id) => id === rawGroup);
    if (legacy === undefined) {
      if (rawGroup !== '') invalid = true;
    } else if (rawLens === 'pillar') pillar ||= legacy;
    else console_ ||= legacy;
    if (rawLens === 'console' && params.get('by') === null) by = 'console';
    rawGroup = '';
  } else if (rawLens !== null && rawLens !== '') {
    const match = LENSES.find((value) => value === rawLens);
    if (match === undefined) invalid = true;
    else lens = match;
  }
  const group =
    lens !== '' && lensGroups(content, lens).some((item) => item.id === rawGroup) ? rawGroup : '';
  if (rawGroup !== group) invalid = true;
  const ids = new Set(content.capabilities.map((c) => c.id));
  const rawCompare = params.getAll('compare');
  const compare = [...new Set(rawCompare.filter((id) => ids.has(id)))].slice(0, MAX_COMPARE);
  if (compare.length !== rawCompare.length) invalid = true;
  return {
    query: params.get('q') ?? '',
    pillar,
    console: console_,
    licensing,
    gcc,
    setup,
    by,
    lens,
    group,
    view,
    compare,
    invalid,
  };
}

/** The lens the matrix view uses: the chosen one, or the layer a capability acts on. */
export const matrixLens = (state: Pick<ExplorerState, 'lens'>): Lens => state.lens || 'layer';

export function explorerSearch(state: ExplorerState): URLSearchParams {
  const next = new URLSearchParams();
  const set = (key: string, value: string, fallback = '') => {
    if (value !== '' && value !== fallback) next.set(key, value);
  };
  set('q', state.query);
  set('pillar', state.pillar);
  set('console', state.console);
  set('licensing', state.licensing);
  set('gcc', state.gcc);
  set('setup', state.setup);
  set('by', state.by, 'pillar');
  set('lens', state.lens);
  if (state.lens !== '') set('group', state.group);
  set('view', state.view, 'table');
  for (const id of state.compare) next.append('compare', id);
  return next;
}

export function filterCapabilities(
  capabilities: Capability[],
  state: Omit<ExplorerState, 'compare' | 'invalid' | 'by' | 'view'>,
  membership: LensMembership,
): Capability[] {
  const terms = state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return capabilities.filter((c) => {
    if (state.pillar !== '' && c.pillar !== state.pillar) return false;
    if (state.console !== '' && c.source.console !== state.console) return false;
    if (
      state.licensing !== '' &&
      (state.licensing === 'base') !== (licensingTier(c) === 'foundational')
    )
      return false;
    if (state.gcc !== '' && (state.gcc === 'available') !== c.source.gccAvailable) return false;
    if (state.setup !== '' && (state.setup === 'platform') !== (c.setup === 'platform'))
      return false;
    if (
      state.lens !== '' &&
      state.group !== '' &&
      !belongsTo(c, state.lens, state.group, membership)
    )
      return false;
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

/** Search words that also offer a filter. A shortcut is a navigation aid, never a product claim. */
export function matchShortcuts<T extends { terms: string[] }>(query: string, shortcuts: T[]): T[] {
  const words = query
    .toLocaleLowerCase()
    .replace(/[^a-z0-9+-]+/g, ' ')
    .trim();
  if (words === '') return [];
  const padded = ` ${words} `;
  return shortcuts.filter((shortcut) =>
    shortcut.terms.some((term) => padded.includes(` ${term.toLocaleLowerCase()} `)),
  );
}

/** The state that applies one shortcut filter, keeping the other filters and clearing the search. */
export function applyFilter(state: ExplorerState, filter: ExplorerFilter): ExplorerState {
  return {
    ...state,
    query: '',
    ...(filter.pillar !== undefined && { pillar: filter.pillar }),
    ...(filter.console !== undefined && { console: filter.console }),
    ...(filter.licensing !== undefined && { licensing: filter.licensing }),
    ...(filter.gcc !== undefined && { gcc: filter.gcc }),
    ...(filter.setup !== undefined && { setup: filter.setup }),
    ...(filter.lens !== undefined && { lens: filter.lens, group: filter.group ?? '' }),
  };
}

export function filterLabel(content: Content, filter: ExplorerFilter): string {
  const copy = content.site.capabilities.explorer;
  if (filter.pillar !== undefined)
    return pillarName(content.pillars.find((p) => p.id === filter.pillar)!);
  if (filter.console !== undefined)
    return content.consoles.find((c) => c.id === filter.console)!.displayName;
  if (filter.licensing !== undefined) return copy.licensingOptions[filter.licensing];
  if (filter.gcc !== undefined) return copy.gccOptions[filter.gcc];
  if (filter.setup !== undefined) return copy.setupOptions[filter.setup];
  const group = lensGroups(content, filter.lens!).find((item) => item.id === filter.group);
  return `${copy.lenses[filter.lens!]}: ${group?.label ?? ''}`;
}

export const hasFilters = (state: ExplorerState): boolean =>
  state.query !== '' ||
  state.pillar !== '' ||
  state.console !== '' ||
  state.licensing !== '' ||
  state.gcc !== '' ||
  state.setup !== '' ||
  state.group !== '';
