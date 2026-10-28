import { describe, expect, it } from 'vitest';
import { content, contentMeta } from '../content/index.ts';
import { evaluateAssessment } from './evaluate.ts';
import { buildPassport, classifyAccess, type AccessHelperInput } from './passport.ts';

const version = contentMeta.contentVersion;
const org = { cloudEnvironment: 'commercial' };
const delegated = {
  accessModel: 'delegated',
  buildPlatform: 'copilot-studio',
  dataSensitivity: 'confidential',
  tools: ['microsoft-mcp'],
  autonomy: 'approval-gated',
  audience: ['employees'],
};
const own = {
  accessModel: 'own-background',
  buildPlatform: 'microsoft-foundry',
  dataSensitivity: 'highly-confidential',
  tools: ['third-party-mcp', 'code-execution'],
  autonomy: 'autonomous',
  audience: ['customers'],
};

describe('classifyAccess', () => {
  const t = true;
  const f = false;
  it.each<[string, AccessHelperInput, ReturnType<typeof classifyAccess>]>([
    ['acts for a person only', { actsForPerson: t, runsAlone: f, ownAccount: f }, 'delegated'],
    ['has its own account', { actsForPerson: f, runsAlone: f, ownAccount: t }, 'own-teammate'],
    [
      'has an account and runs alone',
      { actsForPerson: f, runsAlone: t, ownAccount: t },
      'own-teammate',
    ],
    [
      'runs alone with no account',
      { actsForPerson: f, runsAlone: t, ownAccount: f },
      'own-background',
    ],
    ['acts for people and runs alone', { actsForPerson: t, runsAlone: t, ownAccount: f }, 'mixed'],
    [
      'acts for people and has an account',
      { actsForPerson: t, runsAlone: f, ownAccount: t },
      'mixed',
    ],
    ['does all three', { actsForPerson: t, runsAlone: t, ownAccount: t }, 'mixed'],
    ['none of the three', { actsForPerson: f, runsAlone: f, ownAccount: f }, 'unclear'],
    ['nothing answered', { actsForPerson: null, runsAlone: null, ownAccount: null }, null],
    ['one left open', { actsForPerson: t, runsAlone: null, ownAccount: f }, null],
  ])('%s', (_name, input, expected) => {
    expect(classifyAccess(input)).toBe(expected);
  });

  it('only returns a value the accessModel question knows, or unclear', () => {
    const known = content.questions
      .find((q) => q.id === 'accessModel')!
      .options.map((o) => o.value);
    for (const actsForPerson of [true, false])
      for (const runsAlone of [true, false])
        for (const ownAccount of [true, false]) {
          const outcome = classifyAccess({ actsForPerson, runsAlone, ownAccount })!;
          expect(outcome === 'unclear' || known.includes(outcome)).toBe(true);
        }
  });
});

describe('buildPassport', () => {
  const passport = buildPassport(content, { org, useCase: delegated }, version);

  it('uses the same engine as the readout', () => {
    const result = evaluateAssessment(content, { org, useCase: delegated }, version);
    const inPassport = passport.areas.flatMap((area) => [...area.essential, ...area.recommended]);
    const wanted = result.inScope.filter((entry) => entry.level !== 'consider');
    expect(inPassport.map((entry) => entry.capability.id).sort()).toEqual(
      wanted.map((entry) => entry.capability.id).sort(),
    );
    expect(passport.counts.essential + passport.counts.recommended + passport.counts.consider).toBe(
      result.inScope.length,
    );
  });

  it('groups the controls by area in the order of the areas, and leaves empty areas out', () => {
    const order = [...content.pillars].sort((a, b) => a.order - b.order).map((p) => p.id);
    const ids = passport.areas.map((area) => area.pillar.id);
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    for (const area of passport.areas) {
      expect(area.essential.length + area.recommended.length).toBeGreaterThan(0);
      for (const entry of area.essential) expect(entry.level).toBe('essential');
      for (const entry of area.recommended) expect(entry.level).toBe('recommended');
    }
  });

  it('lists what must be in place once each, starting with what every capability needs', () => {
    const ids = passport.requirements.map((view) => view.item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const baseline = content.requirements
      .filter((set) => set.capabilityIds.includes('all'))
      .flatMap((set) => set.items.map((item) => item.id));
    expect(ids.slice(0, baseline.length)).toEqual(baseline);
    const counts = passport.requirementCounts;
    expect(counts.ready + counts.gap + counts.unknown).toBe(ids.length);
  });

  it('treats what the answers do not cover as to confirm, never as a gap', () => {
    expect(passport.requirementCounts.gap).toBe(0);
    expect(passport.requirementCounts.unknown).toBeGreaterThan(0);
  });

  it('says how the agent acts, and who to license for it', () => {
    expect(passport.access).toBe('delegated');
    expect(passport.accessLabel).toBe(content.accessPatterns.answerLabels.delegated);
    expect(passport.accessPatterns).toEqual(['delegated']);
    expect(passport.populations.length).toBeGreaterThan(0);
    expect(passport.populations.some((view) => view.relevant === false)).toBe(false);
    expect(passport.populations.map((view) => view.population.id)).toContain('delegating-users');
  });

  it('finds the platform entry for where the agent is built', () => {
    expect(passport.platform?.buildPlatforms).toContain('copilot-studio');
  });

  it('names at most three risks, the sure ones first and the most addressed first', () => {
    expect(passport.risks.length).toBeGreaterThan(0);
    expect(passport.risks.length).toBeLessThanOrEqual(3);
    const certain = passport.risks.filter((risk) => risk.certain);
    expect(passport.risks.slice(0, certain.length)).toEqual(certain);
    for (let i = 1; i < certain.length; i += 1)
      expect(certain[i - 1]!.controls).toBeGreaterThanOrEqual(certain[i]!.controls);
  });

  it('licenses the owner of an agent with its own access, not the delegating users', () => {
    const own_ = buildPassport(content, { org, useCase: own }, version);
    const ids = own_.populations.map((view) => view.population.id);
    expect(ids).toContain('own-access-owners');
    expect(ids).not.toContain('delegating-users');
    expect(own_.counts.essential).toBeGreaterThan(passport.counts.essential);
  });

  it('works with no answers: nothing to license yet, and no failure', () => {
    const empty = buildPassport(content, { org: {}, useCase: {} }, version);
    expect(empty.access).toBeNull();
    expect(empty.accessLabel).toBeNull();
    expect(empty.populations).toEqual([]);
    expect(empty.platform).toBeNull();
    expect(empty.risks.length).toBeLessThanOrEqual(3);
  });

  it('does not treat an answer recorded as unknown as an answer', () => {
    const unknown = buildPassport(
      content,
      { org, useCase: { ...delegated, accessModel: 'unknown', buildPlatform: 'unknown' } },
      version,
    );
    expect(unknown.access).toBeNull();
    expect(unknown.platform).toBeNull();
    expect(unknown.populations).toEqual([]);
  });
});
