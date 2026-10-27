import { describe, expect, it } from 'vitest';
import { licensingTier } from './derive.ts';
import { requirementGuides } from './conversation.ts';
import { content } from './index.ts';

const guides = requirementGuides(content);

describe('requirementGuides', () => {
  it('has one guide per requirement area, in reading order', () => {
    expect(guides.map((guide) => guide.pillar.id)).toEqual(
      [...content.pillars].sort((a, b) => a.order - b.order).map((p) => p.id),
    );
  });

  it('covers every capability exactly once and counts the licensing and GCC flags from the catalog', () => {
    expect(guides.flatMap((guide) => guide.capabilities.map((c) => c.id)).sort()).toEqual(
      content.capabilities.map((c) => c.id).sort(),
    );
    for (const guide of guides) {
      expect(guide.total).toBe(guide.capabilities.length);
      expect(guide.premium).toBe(
        guide.capabilities.filter((c) => licensingTier(c) === 'premium').length,
      );
      expect(guide.notInGcc).toBe(guide.capabilities.filter((c) => !c.source.gccAvailable).length);
    }
  });

  it('asks each distinct discovery question once and names the capability that raises it', () => {
    for (const guide of guides) {
      const keys = guide.questions.map((item) => item.question.trim().toLocaleLowerCase());
      expect(new Set(keys).size).toBe(keys.length);
      for (const item of guide.questions) {
        expect(guide.capabilities).toContain(item.capability);
        expect(item.capability.discoveryQuestions).toContain(item.question);
      }
      const raised = new Set(
        guide.capabilities.flatMap((c) =>
          (c.discoveryQuestions ?? []).map((q) => q.trim().toLocaleLowerCase()),
        ),
      );
      expect(new Set(keys)).toEqual(raised);
    }
  });

  it('lists each owner team once with the product areas it configures', () => {
    for (const guide of guides) {
      const teams = guide.people.map((person) => person.team);
      expect(new Set(teams).size).toBe(teams.length);
      expect(teams).toEqual([...teams].sort((a, b) => a.localeCompare(b, 'en')));
      for (const person of guide.people) {
        expect(person.productAreas.length).toBeGreaterThan(0);
        for (const area of person.productAreas)
          expect(content.consoles.map((c) => c.displayName)).toContain(area);
      }
    }
  });
});

describe('conversation content', () => {
  it('numbers five distinct steps, each with an instruction', () => {
    const ids = content.conversation.steps.map((step) => step.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of content.conversation.steps)
      expect(step.instruction.length).toBeGreaterThan(0);
  });

  it('is marked as draft facilitation advice', () => {
    expect(content.conversation.reviewStatus).toBe('draft');
  });
});
