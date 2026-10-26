import type { Content } from './schemas.ts';
import { CONSOLES, CONTROL_POINTS, PILLARS, STAGES, TEMPLATE_KEYS } from './schemas.ts';
import { validateMapping } from './validate-mapping.ts';

export interface ValidationOptions {
  now?: Date;
  staleAfterDays?: number;
  /** When true, a source that nothing references fails the build instead of warning. */
  failOnOrphanedSources?: boolean;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const DAY_MS = 86_400_000;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

function* stringLeaves(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === 'string') {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) yield* stringLeaves(item, `${path}[${index}]`);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      yield* stringLeaves(item, path === '' ? key : `${path}.${key}`);
    }
  }
}

/**
 * Cross-reference checks that a per-file schema can't express. Runs on content that already passed its
 * schema, so shapes are trusted here. Pure: no file access, so tests can feed it fixtures.
 *
 */
export function validateContent(
  content: Content,
  options: ValidationOptions = {},
): ValidationResult {
  const { now = new Date(), staleAfterDays = 90, failOnOrphanedSources = false } = options;
  const errors: string[] = [];
  const warnings: string[] = [];

  const duplicates = (label: string, values: (string | number)[]) => {
    const seen = new Set<string | number>();
    for (const value of values) {
      if (seen.has(value)) errors.push(`${label}: duplicate value "${value}"`);
      seen.add(value);
    }
  };
  duplicates(
    'sources.yaml id',
    content.sources.map((s) => s.id),
  );
  duplicates(
    'capabilities.yaml id',
    content.capabilities.map((c) => c.id),
  );
  duplicates(
    'consoles.yaml id',
    content.consoles.map((c) => c.id),
  );
  duplicates(
    'consoles.yaml slug',
    content.consoles.map((c) => c.slug),
  );
  duplicates(
    'consoles.yaml order',
    content.consoles.map((c) => c.order),
  );
  duplicates(
    'pillars.yaml order',
    content.pillars.map((p) => p.order),
  );
  duplicates(
    'control-points.yaml order',
    content.controlPoints.map((c) => c.order),
  );
  duplicates(
    'lifecycle.yaml order',
    content.lifecycle.map((s) => s.order),
  );

  // The taxonomy files supply labels; the ids themselves are typed, so the two must match exactly.
  const sameIds = (file: string, actual: string[], expected: readonly string[]) => {
    duplicates(`${file} id`, actual);
    for (const id of expected) {
      if (!actual.includes(id)) errors.push(`${file}: missing entry for "${id}"`);
    }
    for (const id of actual) {
      if (!expected.includes(id)) errors.push(`${file}: "${id}" is not a known id`);
    }
  };
  sameIds(
    'pillars.yaml',
    content.pillars.map((p) => p.id),
    PILLARS,
  );
  sameIds(
    'consoles.yaml',
    content.consoles.map((c) => c.id),
    CONSOLES,
  );
  sameIds(
    'control-points.yaml',
    content.controlPoints.map((c) => c.id),
    CONTROL_POINTS,
  );
  sameIds(
    'lifecycle.yaml',
    content.lifecycle.map((s) => s.id),
    STAGES,
  );

  // Source references.
  const sourceIds = new Set(content.sources.map((s) => s.id));
  const referenced = new Set<string>();
  const citeSource = (where: string, id: string | undefined) => {
    if (id === undefined) return;
    referenced.add(id);
    if (!sourceIds.has(id)) errors.push(`${where}: unknown source "${id}"`);
  };
  for (const c of content.capabilities) {
    const where = `capabilities.yaml › ${c.id}`;
    citeSource(`${where} › source.sourceId`, c.source.sourceId);
    for (const note of c.sourceNotes ?? []) citeSource(`${where} › sourceNotes`, note.sourceId);
    for (const dep of c.dependencies ?? []) citeSource(`${where} › dependencies`, dep.sourceId);
    for (const pre of c.prerequisites ?? []) citeSource(`${where} › prerequisites`, pre.sourceId);
  }
  for (const p of content.pillars) citeSource(`pillars.yaml › ${p.id}`, p.sourceId);
  for (const id of content.site.footerSourceIds) citeSource('site.yaml › footerSourceIds', id);
  const mapping = validateMapping(content, (where, id) => citeSource(where, id));
  errors.push(...mapping.errors);
  warnings.push(...mapping.warnings);

  const learningCollections = [
    ['building-blocks.yaml', content.buildingBlocks],
    ['learn.yaml flow', content.learn.flow],
    ['learn.yaml integration', content.learn.integration],
    ['learn.yaml positioning', content.learn.positioning],
    ['learn.yaml frontier', content.learn.frontier],
  ] as const;
  const catalogIds = new Set(content.capabilities.map((c) => c.id));
  for (const [file, items] of learningCollections) {
    duplicates(
      `${file} id`,
      items.map((item) => item.id),
    );
    for (const item of items) {
      const where = `${file} › ${item.id}`;
      citeSource(where, item.sourceId);
      citeSource(`${where} › technicalSourceId`, item.technicalSourceId);
      if (item.technical !== undefined && item.technicalSourceId === undefined) {
        errors.push(`${where}: technical text needs a technicalSourceId`);
      }
      duplicates(`${where} capabilityIds`, item.capabilityIds);
      for (const id of item.capabilityIds) {
        if (!catalogIds.has(id)) errors.push(`${where}: unknown capability "${id}"`);
      }
    }
  }
  for (const [file, items] of [
    ['glossary.yaml', content.glossary],
    ['faq.yaml', content.faq],
  ] as const) {
    duplicates(
      `${file} id`,
      items.map((item) => item.id),
    );
    for (const item of items) citeSource(`${file} › ${item.id}`, item.sourceId);
  }
  duplicates(
    'glossary.yaml term or alias',
    content.glossary.flatMap((entry) =>
      [entry.term, ...entry.aliases].map((term) => term.toLocaleLowerCase()),
    ),
  );
  duplicates(
    'personas.yaml id',
    content.personas.map((persona) => persona.id),
  );
  const learningAnchors = new Set([
    'concepts',
    'integration',
    'building-blocks',
    'glossary',
    'myths',
    'positioning',
    ...content.glossary.map((entry) => `glossary-${entry.id}`),
  ]);
  for (const persona of content.personas) {
    const anchor = persona.href.split('#')[1];
    if (anchor && !learningAnchors.has(anchor)) {
      errors.push(`personas.yaml › ${persona.id}: unknown learning anchor "${anchor}"`);
    }
  }

  // Template placeholders must be values the app computes; stray braces are typos.
  for (const [path, text] of stringLeaves(content.site, '')) {
    for (const match of text.matchAll(PLACEHOLDER)) {
      const key = match[1] as string;
      if (!TEMPLATE_KEYS.includes(key)) {
        errors.push(`site.yaml › ${path}: unknown placeholder {${key}}`);
      }
    }
    if (/[{}]/.test(text.replace(PLACEHOLDER, ''))) {
      errors.push(`site.yaml › ${path}: unbalanced or malformed { } in "${text}"`);
    }
  }
  duplicates(
    'site.yaml overview.kpis id',
    content.site.overview.kpis.map((k) => k.id),
  );

  // Changelog. "all" is reserved for entries that touch the whole catalog.
  if (content.changelog.length === 0) errors.push('changelog.md: needs at least one entry');
  const capabilityIds = new Set(content.capabilities.map((c) => c.id));
  if (capabilityIds.has('all')) errors.push('capabilities.yaml: the id "all" is reserved');
  for (const entry of content.changelog) {
    for (const id of entry.affects) {
      if (id !== 'all' && !capabilityIds.has(id)) {
        errors.push(
          `changelog.md › ${entry.date} "${entry.title}": affects unknown capability "${id}"`,
        );
      }
    }
  }

  // Sources nothing refers to.
  for (const source of content.sources) {
    if (!referenced.has(source.id)) {
      const message = `sources.yaml › ${source.id}: not referenced by any content (cite it, or remove it)`;
      (failOnOrphanedSources ? errors : warnings).push(message);
    }
  }

  // Staleness and unverified sources.
  const ageInDays = (isoDate: string) =>
    (now.getTime() - Date.parse(`${isoDate}T00:00:00Z`)) / DAY_MS;
  const checkDate = (where: string, isoDate: string) => {
    const age = ageInDays(isoDate);
    if (age < -1) errors.push(`${where}: lastVerified ${isoDate} is in the future`);
    else if (age > staleAfterDays) {
      warnings.push(
        `${where}: lastVerified ${isoDate} is ${Math.floor(age)} days old (limit ${staleAfterDays})`,
      );
    }
  };
  for (const c of content.capabilities) {
    checkDate(`capabilities.yaml › ${c.id}`, c.source.lastVerified);
  }
  for (const s of content.sources) {
    if (s.lastVerified === null) warnings.push(`sources.yaml › ${s.id}: not verified yet`);
    else checkDate(`sources.yaml › ${s.id}`, s.lastVerified);
  }
  const datedLearning = [
    ...learningCollections.flatMap(([file, items]) =>
      items.map((item) => ({ where: `${file} › ${item.id}`, date: item.lastVerified })),
    ),
    ...content.glossary.map((item) => ({
      where: `glossary.yaml › ${item.id}`,
      date: item.lastVerified,
    })),
    ...content.faq.map((item) => ({ where: `faq.yaml › ${item.id}`, date: item.lastVerified })),
  ];
  for (const { where, date } of datedLearning) {
    if (date === null) warnings.push(`${where}: not verified yet`);
    else checkDate(where, date);
  }

  return { errors, warnings };
}
