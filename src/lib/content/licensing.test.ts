import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import { handoffText, populationViews, segmentFor } from './licensing.ts';

const ACCESS = ['delegated', 'own-teammate', 'own-background', 'mixed'] as const;
const relevance = (access: string | null, audience: string[] | null) =>
  Object.fromEntries(
    populationViews(content, { access, audience }).map((view) => [
      view.population.id,
      view.relevant,
    ]),
  );

describe('populationViews', () => {
  it('licenses the users who delegate for delegated agents, and the owner, sponsor or manager for own access', () => {
    expect(relevance('delegated', null)).toMatchObject({
      'delegating-users': true,
      'own-access-owners': false,
    });
    expect(relevance('own-background', null)).toMatchObject({
      'delegating-users': false,
      'own-access-owners': true,
    });
    expect(relevance('own-teammate', null)).toMatchObject({
      'delegating-users': false,
      'own-access-owners': true,
    });
  });

  it('applies both populations to a mixed agent', () => {
    expect(relevance('mixed', null)).toMatchObject({
      'delegating-users': true,
      'own-access-owners': true,
    });
  });

  it('never hides a population while the access answer is missing', () => {
    expect(relevance(null, null)).toMatchObject({
      'delegating-users': null,
      'own-access-owners': null,
    });
  });

  it('treats an answer recorded as unknown like a missing one, never as a decisive value', () => {
    expect(relevance('unknown', null)).toMatchObject({
      'delegating-users': null,
      'own-access-owners': null,
    });
    expect(relevance('', null)).toMatchObject({
      'delegating-users': null,
      'own-access-owners': null,
    });
    expect(relevance('delegated', ['unknown'])['external-users']).toBeNull();
    expect(relevance('delegated', ['customers', 'unknown'])['external-users']).toBeNull();
    expect(relevance('delegated', [])['external-users']).toBeNull();
  });

  it('brings in outside users only for partner or customer audiences', () => {
    expect(relevance('delegated', ['employees'])['external-users']).toBe(false);
    expect(relevance('delegated', ['employees', 'customers'])['external-users']).toBe(true);
    expect(relevance('delegated', ['partners'])['external-users']).toBe(true);
    expect(relevance('delegated', null)['external-users']).toBeNull();
  });

  it('always includes the populations that do not depend on an answer', () => {
    const result = relevance('delegated', ['employees']);
    for (const id of ['interacting-users', 'copilot-users', 'administrators', 'agents-themselves'])
      expect(result[id]).toBe(true);
  });

  it('lists required populations first, then recommended, then those not stated', () => {
    const needs = populationViews(content, { access: null, audience: null }).map(
      (view) => view.population.need,
    );
    const order = ['required', 'recommended', 'not-stated', 'not-licensed'];
    expect(needs.map((need) => order.indexOf(need))).toEqual(
      needs.map((need) => order.indexOf(need)).sort((a, b) => a - b),
    );
  });

  it.each(ACCESS)('names at least one required population for "%s"', (access) => {
    const required = populationViews(content, { access, audience: null }).filter(
      (view) => view.population.need === 'required' && view.relevant === true,
    );
    expect(required.length).toBeGreaterThan(0);
  });

  it('says plainly where Microsoft is silent, and what to ask', () => {
    for (const { population } of populationViews(content, { access: null, audience: null })) {
      if (population.need === 'not-stated') expect(population.confirm).toBeDefined();
    }
  });
});

describe('segmentFor', () => {
  it.each([
    ['m365-e7', 'e7'],
    ['m365-e5', 'enterprise'],
    ['m365-e3', 'enterprise'],
    ['o365-e3-ems-e3', 'enterprise'],
    ['business-premium', 'smb'],
    ['frontline-f1-f3', 'frontline'],
    ['education-a5', 'education'],
    ['education-a3', 'education'],
  ])('maps the plan %s to the %s prerequisites', (plan, segment) => {
    expect(segmentFor(content, plan)?.id).toBe(segment);
  });

  it('has none for another plan or an unknown one', () => {
    expect(segmentFor(content, 'other')).toBeNull();
    expect(segmentFor(content, null)).toBeNull();
  });
});

describe('handoffText', () => {
  const base = {
    customer: 'Fictional Contoso',
    access: 'delegated',
    accessLabel: 'Delegated',
    audience: ['employees'],
  };

  it('titles the note with the customer, or the heading without one', () => {
    expect(
      handoffText(content, base).startsWith('# Licensing questions for Fictional Contoso'),
    ).toBe(true);
    expect(
      handoffText(content, { ...base, customer: '  ' }).startsWith(
        `# ${content.licensing.handoff.heading}`,
      ),
    ).toBe(true);
  });

  it('lists the populations that apply and leaves out those that do not', () => {
    const text = handoffText(content, base);
    expect(text).toContain('Users who delegate their access to the agent');
    expect(text).not.toContain('The owner, sponsor or manager of an agent with its own access');
    expect(text).not.toContain('People outside the organization');
  });

  it('keeps the populations that depend on an unanswered question, with what to ask, in the note', () => {
    const text = handoffText(content, { ...base, access: 'unknown', audience: ['unknown'] });
    expect(text).toContain('Users who delegate their access to the agent');
    expect(text).toContain('The owner, sponsor or manager of an agent with its own access');
    expect(text).toContain('People outside the organization');
  });

  it('adds outside users, and what to ask, when the audience includes customers', () => {
    const text = handoffText(content, { ...base, audience: ['customers'] });
    expect(text).toContain('People outside the organization');
    expect(text).toContain(
      content.licensing.who.populations.find((p) => p.id === 'external-users')!.confirm!,
    );
  });

  it('numbers the questions for the specialist and names the sources', () => {
    const text = handoffText(content, base);
    content.licensing.handoff.questions.forEach((question, index) =>
      expect(text).toContain(`${index + 1}. ${question}`),
    );
    expect(text).toContain(content.sources.find((s) => s.id === 'lic-faq')!.title);
    expect(text).toContain(content.licensing.notice);
  });

  it('states no price', () => {
    expect(handoffText(content, base)).not.toMatch(/[$€£]\s?\d/);
  });
});
