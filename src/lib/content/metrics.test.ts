import { describe, expect, it } from 'vitest';
import { licensingTier, needsAgentDecision, ownerTeamOf, sourcesDiffer } from './derive.ts';
import { content } from './index.ts';
import { computeMetrics } from './metrics.ts';
import type { Capability, PillarId } from './schemas.ts';

const base = content.capabilities[0] as Capability;
const make = (id: string, pillar: PillarId, overrides: Partial<Capability> = {}): Capability => ({
  ...structuredClone(base),
  id,
  pillar,
  ...overrides,
});
const input = (capabilities: Capability[]) => ({
  capabilities,
  pillars: content.pillars,
  consoles: content.consoles,
  controlPoints: content.controlPoints,
  contentVersion: 'test',
});

describe('computeMetrics', () => {
  it('reports every pillar that ties for the largest, never just one', () => {
    const metrics = computeMetrics(
      input([make('a', 'observe'), make('b', 'govern'), make('c', 'secure')]),
    );
    expect(metrics.largestPillarCount).toBe(1);
    expect(metrics.largestPillarLabel).toBe('Observe, Govern and Secure');
  });

  it('names a single largest pillar', () => {
    const metrics = computeMetrics(
      input([make('a', 'secure'), make('b', 'secure'), make('c', 'govern')]),
    );
    expect(metrics.largestPillarLabel).toBe('Secure');
    expect(metrics.largestPillarCount).toBe(2);
  });

  it('copes with an empty catalog', () => {
    const metrics = computeMetrics(input([]));
    expect(metrics.capabilityCount).toBe(0);
    expect(metrics.platformShare).toBe(0);
    expect(metrics.lastVerified).toBe('');
  });

  it('counts per-agent decisions as setup "agent" plus "both"', () => {
    const metrics = computeMetrics(
      input([
        make('a', 'govern', { setup: 'platform' }),
        make('b', 'govern', { setup: 'agent' }),
        make('c', 'govern', { setup: 'both' }),
      ]),
    );
    expect(metrics.agentDecisionCount).toBe(2);
    expect(metrics.platformCount).toBe(1);
  });

  it('reports the most recent verification date', () => {
    const older = make('a', 'govern');
    older.source.lastVerified = '2026-01-05';
    const newer = make('b', 'govern');
    newer.source.lastVerified = '2026-10-23';
    expect(computeMetrics(input([older, newer])).lastVerified).toBe('2026-10-23');
  });

  it('reports the newest source check, ignoring sources that were never checked', () => {
    const capability = make('a', 'govern');
    capability.source.lastVerified = '2026-10-23';
    const metrics = computeMetrics({
      ...input([capability]),
      sources: [
        { lastVerified: '2026-09-01' },
        { lastVerified: null },
        { lastVerified: '2026-10-27' },
      ],
    });
    expect(metrics.sourcesChecked).toBe('2026-10-27');
  });

  it('falls back to the capability check date when no source has been checked', () => {
    const capability = make('a', 'govern');
    capability.source.lastVerified = '2026-10-23';
    expect(computeMetrics(input([capability])).sourcesChecked).toBe('2026-10-23');
  });
});

describe('derived fields', () => {
  it('derives the licensing tier from the base-plan column', () => {
    expect(
      licensingTier(
        make('a', 'govern', { source: { ...base.source, includedWithBasePlans: true } }),
      ),
    ).toBe('foundational');
    expect(
      licensingTier(
        make('b', 'govern', { source: { ...base.source, includedWithBasePlans: false } }),
      ),
    ).toBe('premium');
  });

  it('flags sources that differ only when a note says so', () => {
    expect(
      sourcesDiffer(
        make('a', 'govern', { sourceNotes: [{ sourceId: 'lic-faq', note: 'x', differs: true }] }),
      ),
    ).toBe(true);
    expect(
      sourcesDiffer(
        make('b', 'govern', { sourceNotes: [{ sourceId: 'a365-registry', note: 'x' }] }),
      ),
    ).toBe(false);
    expect(sourcesDiffer(make('c', 'govern', { sourceNotes: undefined }))).toBe(false);
  });

  it('needs a per-agent decision unless setup is platform-only', () => {
    expect(needsAgentDecision(make('a', 'govern', { setup: 'platform' }))).toBe(false);
    expect(needsAgentDecision(make('b', 'govern', { setup: 'both' }))).toBe(true);
    expect(needsAgentDecision(make('c', 'govern', { setup: 'agent' }))).toBe(true);
  });

  it('uses the console default owner team unless the capability overrides it', () => {
    const entra = make('a', 'secure', { source: { ...base.source, console: 'Entra' } });
    expect(ownerTeamOf(entra, content.consoles)).toBe('Identity team');
    expect(ownerTeamOf({ ...entra, ownerTeam: 'Custom team' }, content.consoles)).toBe(
      'Custom team',
    );
  });
});
