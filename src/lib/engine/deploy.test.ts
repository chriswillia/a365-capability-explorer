import { describe, expect, it } from 'vitest';
import { content, contentMeta } from '../content/index.ts';
import { buildDeploy } from './deploy.ts';

const version = contentMeta.contentVersion;
const rank = { gap: 0, unknown: 1, ready: 2 } as const;
const answered = {
  org: { cloudEnvironment: 'commercial' },
  useCase: {
    accessModel: 'own-background',
    buildPlatform: 'microsoft-foundry',
    dataSensitivity: 'confidential',
    tools: ['third-party-mcp'],
    autonomy: 'autonomous',
    audience: ['employees'],
    stage: 'production',
    sponsor: 'not-yet',
  },
};

describe('buildDeploy', () => {
  const generic = buildDeploy(content, null, version);
  const deploy = buildDeploy(content, answered, version);

  it('lists the three gates in order, each with the steps that belong to it', () => {
    expect(deploy.gates.map((g) => g.gate.id)).toEqual(content.guardrails.gates.map((g) => g.id));
    for (const { gate, steps } of deploy.gates)
      for (const { view } of steps) expect(view.item.gate).toBe(gate.id);
  });

  it('puts gaps first, then what is to confirm, then what is in place, in every gate', () => {
    for (const { steps } of [...deploy.gates, ...generic.gates]) {
      const ranks = steps.map((s) => rank[s.view.status]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('marks a step as a gap when the answers say it is not in place, and never as one when they do not say', () => {
    const owner = deploy.gates
      .flatMap((g) => g.steps)
      .find((s) => s.view.item.id === 'registered-owner')!;
    expect(owner.view.status).toBe('gap');
    expect(generic.counts.gap).toBe(0);
    expect(generic.counts.ready).toBe(0);
    expect(generic.counts.unknown).toBe(generic.total);
  });

  it('says where each step is configured and who owns it, each once', () => {
    for (const step of deploy.gates.flatMap((g) => g.steps)) {
      const ids = step.consoles.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain('N/A');
      expect(new Set(step.ownerTeams).size).toBe(step.ownerTeams.length);
      expect(step.capabilities.map((c) => c.id).sort()).toEqual(
        [...step.view.item.capabilityIds]
          .filter((id) => content.capabilities.some((c) => c.id === id))
          .sort(),
      );
    }
    const audit = deploy.gates
      .flatMap((g) => g.steps)
      .find((s) => s.view.item.id === 'audit-evidence')!;
    expect(audit.consoles.map((c) => c.id)).toContain('Purview');
    const licensed = deploy.gates
      .flatMap((g) => g.steps)
      .find((s) => s.view.item.id === 'licensed-people')!;
    expect(licensed.consoles).toEqual([]);
    expect(licensed.ownerTeams).toEqual([]);
  });

  it('gives every step a way to show it works', () => {
    for (const item of content.guardrails.items)
      expect(item.proveIt.trim().length).toBeGreaterThan(20);
  });

  it('takes one gate and one roadmap wave for each period', () => {
    expect(deploy.periods.map((p) => p.gate.id)).toEqual(['pilot', 'production', 'scale']);
    expect(deploy.periods.map((p) => p.period.wave)).toEqual([1, 2, 3]);
    for (const { steps, gate } of deploy.periods)
      expect(steps).toBe(deploy.gates.find((g) => g.gate.id === gate.id)!.steps);
  });

  it('brings in only the Essential and Recommended controls for this agent, in the wave of the period', () => {
    const controls = deploy.periods.flatMap((p) => p.controls);
    expect(controls.length).toBeGreaterThan(0);
    for (const { period, controls: list } of deploy.periods)
      for (const entry of list) {
        expect(['essential', 'recommended']).toContain(entry.level);
        expect(entry.wave).toBe(period.wave);
      }
    const ids = controls.map((c) => c.capability.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no controls to place without an assessment, and still lists every step', () => {
    expect(generic.periods.flatMap((p) => p.controls)).toEqual([]);
    expect(generic.total).toBeGreaterThanOrEqual(content.guardrails.items.length - 3);
  });

  it('counts the steps once each', () => {
    expect(deploy.counts.ready + deploy.counts.gap + deploy.counts.unknown).toBe(deploy.total);
    expect(deploy.gates.flatMap((g) => g.steps).length).toBe(deploy.total);
  });
});
