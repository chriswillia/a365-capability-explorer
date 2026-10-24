import { describe, expect, it } from 'vitest';
import snapshot from '../../../content/source-snapshot.json';
import { content, metrics } from './index.ts';
import { normalizeSourceText } from './normalize.ts';

/*
 * Seed catalog assertions (brief section 4). These are deliberate tripwires on the source-of-truth numbers.
 * When the catalog changes on purpose (a new capability, a changed availability column), update the
 * expected numbers below in the same pull request, and add a content/changelog.md entry.
 */

describe('seed catalog KPIs', () => {
  it('has 26 capabilities: 4 foundational and 22 premium', () => {
    expect(metrics.capabilityCount).toBe(26);
    expect(metrics.foundationalCount).toBe(4);
    expect(metrics.premiumCount).toBe(22);
  });

  it('has 12 capabilities available in GCC', () => {
    expect(metrics.gccCount).toBe(12);
    expect(metrics.notInGccCount).toBe(14);
  });

  it('splits by console', () => {
    expect(metrics.byConsole).toEqual({
      'Microsoft 365 admin center': 7,
      Purview: 7,
      Entra: 4,
      Defender: 4,
      Intune: 3,
      'N/A': 1,
    });
    expect(metrics.consoleCount).toBe(6);
  });

  it('splits by pillar: Secure 12, Govern 10, Observe 4', () => {
    expect(metrics.byPillar).toEqual({ secure: 12, govern: 10, observe: 4 });
  });

  it('splits by setup: platform 21, both 3, agent 2', () => {
    expect(metrics.bySetup).toEqual({ platform: 21, both: 3, agent: 2 });
    expect(metrics.agentDecisionCount).toBe(5);
  });

  it('splits by control point', () => {
    expect(metrics.byControlPoint).toEqual({
      registry: 6,
      oversight: 6,
      identity: 4,
      data: 4,
      endpoint: 3,
      tools: 2,
      network: 1,
    });
    expect(metrics.coveredControlPointCount).toBe(7);
  });

  it('makes platform foundations the majority, so the Overview may say "most"', () => {
    expect(metrics.platformShare).toBeGreaterThan(0.5);
  });
});

describe('seed catalog content', () => {
  it('marks exactly the four rows included with base plans as foundational', () => {
    const foundational = content.capabilities
      .filter((c) => c.source.includedWithBasePlans)
      .map((c) => c.id);
    expect(foundational).toEqual([
      'registry-inventory',
      'governance-actions',
      'lifecycle-automation',
      'registry-sync',
    ]);
  });

  it('seeds the Graph API as a preview, which the registry documentation states', () => {
    const graph = content.capabilities.find((c) => c.id === 'registry-graph-api');
    expect(graph?.status).toBe('preview');
    expect(content.capabilities.filter((c) => c.status !== undefined)).toHaveLength(1);
  });

  it('seeds the five "sources differ" notes from section 4.3', () => {
    const differing = content.capabilities.filter((c) => c.sourceNotes?.some((n) => n.differs));
    expect(differing.map((c) => c.id).sort()).toEqual([
      'defender-shadow-ai',
      'intune-block-local',
      'lifecycle-automation',
      'purview-audit-ediscovery',
      'registry-sync',
    ]);
  });

  it('keeps every capability as a draft until a subject-matter expert signs it off', () => {
    expect(content.capabilities.every((c) => c.reviewStatus === 'draft')).toBe(true);
  });

  it('gives every capability a primary layer and at least one lifecycle stage', () => {
    for (const c of content.capabilities) {
      expect(c.controlPoints.length, c.id).toBeGreaterThan(0);
      expect(c.lifecycleStages.length, c.id).toBeGreaterThan(0);
    }
  });
});

describe('published feature table snapshot', () => {
  const byText = new Map(snapshot.rows.map((row) => [normalizeSourceText(row.feature), row]));

  it('has the same number of rows as the catalog', () => {
    expect(snapshot.rows).toHaveLength(content.capabilities.length);
  });

  it.each(content.capabilities.map((c) => [c.id, c] as const))(
    '%s matches its published row after normalization',
    (_id, capability) => {
      const row = byText.get(normalizeSourceText(capability.source.featureText));
      expect(row, 'no published row has this feature text').toBeDefined();
      expect(normalizeSourceText(row!.console).toLowerCase()).toBe(
        capability.source.console.toLowerCase(),
      );
      expect(row!.includedWithBasePlans).toBe(capability.source.includedWithBasePlans);
      expect(row!.availableWithE7G7OrA365).toBe(capability.source.availableWithE7G7OrA365);
      expect(row!.gccAvailable).toBe(capability.source.gccAvailable);
    },
  );
});
