import { describe, expect, it } from 'vitest';
import { FaqSchema, GlossaryEntrySchema, LearningItemSchema, PersonaSchema } from './schemas.ts';

const evidence = {
  sourceId: 'sd-a365',
  evidence: 'inferred',
  reviewStatus: 'draft',
  lastVerified: '2026-10-24',
};
const item = {
  id: 'identity',
  title: 'Identity',
  summary: 'A sourced explanation.',
  capabilityIds: ['entra-access-packages'],
  ...evidence,
};

describe('learning schemas', () => {
  it('accepts sourced draft content, and explicit unpublished placeholders', () => {
    expect(LearningItemSchema.safeParse(item).success).toBe(true);
    expect(
      LearningItemSchema.safeParse({ ...item, summary: null, lastVerified: null }).success,
    ).toBe(true);
    expect(
      FaqSchema.safeParse({
        id: 'license',
        myth: 'Every agent needs a license.',
        fact: null,
        ...evidence,
        lastVerified: null,
      }).success,
    ).toBe(true);
  });
  it('rejects unverified published claims, unknown fields, invalid evidence and oversized summaries', () => {
    for (const change of [
      { lastVerified: null },
      { evidence: 'guess' },
      { reviewStatus: 'approved' },
      { summary: Array(41).fill('word').join(' ') },
      { sumary: 'typo' },
    ])
      expect(LearningItemSchema.safeParse({ ...item, ...change }).success).toBe(false);
    expect(
      FaqSchema.safeParse({
        id: 'license',
        myth: 'Myth',
        fact: 'Unverified claim',
        ...evidence,
        lastVerified: null,
      }).success,
    ).toBe(false);
  });
  it('requires definitions and prevents persona links to unavailable features or external sites', () => {
    const term = {
      id: 'mcp',
      term: 'MCP',
      aliases: [],
      definition: 'Model Context Protocol.',
      ...evidence,
    };
    expect(GlossaryEntrySchema.safeParse(term).success).toBe(true);
    expect(GlossaryEntrySchema.safeParse({ ...term, definition: '' }).success).toBe(false);
    const persona = {
      id: 'builder',
      label: 'Builder',
      need: 'Integration paths',
      startLabel: 'Start',
      reviewStatus: 'draft',
    };
    for (const href of [
      '/learn#integration',
      '/capabilities?lens=layer',
      '/pitch',
      '/fit',
      '/licensing',
    ]) {
      expect(PersonaSchema.safeParse({ ...persona, href }).success).toBe(true);
    }
    for (const href of ['//evil.example', 'https://example.com', '/diagnostic', '/patterns']) {
      expect(PersonaSchema.safeParse({ ...persona, href }).success).toBe(false);
    }
  });
});
