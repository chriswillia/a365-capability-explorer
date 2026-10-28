import { describe, expect, it } from 'vitest';
import { content } from './index.ts';

/** Every string in a piece of content, with the path that leads to it. */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value))
    return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value !== null && typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) =>
      strings(item, path === '' ? key : `${path}.${key}`),
    );
  return [];
}

const playbook = {
  value: content.value,
  licensing: content.licensing,
  requirements: content.requirements,
  accessPatterns: content.accessPatterns,
  guardrails: content.guardrails,
  fit: content.fit,
  conversation: content.conversation,
  overview: content.site.overview,
  routes: content.site.routes,
  nav: content.site.ui.nav,
  audience: content.site.ui.audience,
  readout: content.site.readout,
};
const playbookStrings = Object.entries(playbook).flatMap(([name, value]) => strings(value, name));
const everything = strings(content);
const offenders = (pattern: RegExp, source: [string, string][]) =>
  source.filter(([, text]) => pattern.test(text)).map(([path, text]) => `${path}: ${text}`);

describe('seller playbook content', () => {
  it('states no price anywhere, because the licensing pages quote prices that change', () => {
    const price =
      /[$€£]\s?\d|\b\d[\d,.]*\s?(?:USD|EUR|GBP|dollars?|euros?)\b|\bper user per month\b|\/\s?user\/\s?month/i;
    expect(offenders(price, everything)).toEqual([]);
  });

  it('avoids the hype words the style guide names', () => {
    const hype =
      /\b(powerful|seamless(?:ly)?|unlock(?:s|ed|ing)?|supercharge[sd]?|revolutionary|best-in-class|game-?chang(?:er|ing)|cutting-edge|world-class|effortless(?:ly)?)\b/i;
    expect(offenders(hype, playbookStrings)).toEqual([]);
  });

  it('says "Agent 365", not "A365", in text people read, except in the product name', () => {
    expect(offenders(/\bA365\b(?! Capability Explorer)/, playbookStrings)).toEqual([]);
  });

  it('calls it own access, as Microsoft describes it, and never "owned access"', () => {
    expect(offenders(/\bowned (?:access|agent)/i, playbookStrings)).toEqual([]);
  });

  it('does not use "Required" as a recommendation level outside the licensing labels', () => {
    const levels = playbookStrings.filter(
      ([path]) => !path.startsWith('licensing.') && !path.startsWith('requirements'),
    );
    expect(offenders(/^required$/i, levels)).toEqual([]);
  });

  it('keeps every sourced statement tied to a source and a date', () => {
    const sources = new Set(content.sources.map((source) => source.id));
    const checks: [string, readonly string[], string | null | undefined][] = [];
    for (const rule of content.requirements)
      for (const item of rule.items) checks.push([item.id, item.sourceIds, item.lastVerified]);
    for (const row of content.accessPatterns.capabilities)
      checks.push([row.capabilityId, row.sourceIds, row.lastVerified]);
    for (const population of content.licensing.who.populations)
      checks.push([population.id, population.sourceIds, population.lastVerified]);
    for (const platform of content.fit.platforms.items)
      checks.push([platform.id, platform.sourceIds, platform.lastVerified]);
    expect(checks.length).toBeGreaterThan(20);
    for (const [id, sourceIds, verified] of checks) {
      expect(sourceIds.length, id).toBeGreaterThan(0);
      for (const sourceId of sourceIds)
        expect(sources.has(sourceId), `${id}: ${sourceId}`).toBe(true);
      expect(verified, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('marks all editorial playbook content as a draft until a subject-matter expert reviews it', () => {
    for (const [name, file] of Object.entries({
      value: content.value,
      licensing: content.licensing,
      accessPatterns: content.accessPatterns,
      guardrails: content.guardrails,
      fit: content.fit,
    }))
      expect(file.reviewStatus, name).toBe('draft');
  });
});

describe('licensing prerequisite content', () => {
  const { productTerms, differs } = content.licensing.prerequisites;

  it('cites the Product Terms as the contractual source and lists the prerequisite licenses', () => {
    expect(productTerms.sourceIds).toContain('product-terms-a365');
    expect(productTerms.plans.length).toBeGreaterThanOrEqual(4);
    expect(productTerms.plans.join(' ')).toMatch(/E5/);
  });

  it('shows each difference as two or more statements, each from a source the item cites', () => {
    expect(differs.items.length).toBeGreaterThan(0);
    for (const item of differs.items) {
      expect(item.statements.length, item.id).toBeGreaterThanOrEqual(2);
      for (const statement of item.statements)
        expect(item.sourceIds, item.id).toContain(statement.sourceId);
    }
  });

  it('tells the seller which source governs a purchase', () => {
    for (const item of differs.items) expect(item.advice, item.id).toMatch(/Product Terms/);
  });

  it('lists public help with deployment, each item sourced', () => {
    expect(content.licensing.help.items.length).toBeGreaterThan(0);
    for (const item of content.licensing.help.items)
      expect(item.sourceIds.length).toBeGreaterThan(0);
  });
});

describe('requirement content', () => {
  const items = content.requirements.flatMap((set) => set.items);

  it('gives every requirement the question to ask the customer, worded as a question', () => {
    for (const item of items) expect(item.askPrompt, item.id).toMatch(/\?$/);
  });

  it('names where a requirement applies only when the source says so, never as a guess', () => {
    const unset = items.filter((item) => item.appliesTo === undefined).map((item) => item.id);
    expect(unset).toEqual(['accept-terms', 'traffic-forwarding']);
  });
});
