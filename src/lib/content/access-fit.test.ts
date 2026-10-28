import { describe, expect, it } from 'vitest';
import { accessFit, accessModelLabel } from './access-fit.ts';
import { content } from './index.ts';
import type { Content } from './schemas.ts';

describe('accessFit', () => {
  it('says a capability differs by how the agent acts when a sourced statement says so', () => {
    const fit = accessFit(content, 'entra-conditional-access');
    expect(fit.kind).toBe('differs');
    if (fit.kind === 'differs') expect(fit.row.sourceIds.length).toBeGreaterThan(0);
  });

  it('lists the ways of acting a statement covers when none differs', () => {
    const fit = accessFit(content, 'entra-access-packages');
    expect(fit).toMatchObject({ kind: 'stated', patterns: ['own'] });
  });

  it('says "unsplit", never "the same", for a capability Microsoft does not split', () => {
    expect(accessFit(content, 'observability')).toEqual({ kind: 'unsplit' });
    expect(accessFit(content, 'no-such-capability')).toEqual({ kind: 'unsplit' });
  });

  it('is derived from the stated rows only: every other capability is unsplit', () => {
    const stated = new Set(content.accessPatterns.capabilities.map((row) => row.capabilityId));
    for (const capability of content.capabilities)
      expect(accessFit(content, capability.id).kind === 'unsplit', capability.id).toBe(
        !stated.has(capability.id),
      );
  });

  it('treats a row that applies to nothing as unsplit', () => {
    const data: Content = structuredClone(content);
    const row = data.accessPatterns.capabilities[0]!;
    Object.assign(row, { delegated: 'not-stated', own: 'not-stated', agentAccount: 'not-stated' });
    expect(accessFit(data, row.capabilityId)).toEqual({ kind: 'unsplit' });
  });
});

describe('accessModelLabel', () => {
  it('names each way an agent can act, and nothing for a missing or unknown answer', () => {
    expect(accessModelLabel(content, 'delegated')).toBe('Delegated access');
    expect(accessModelLabel(content, 'mixed')).toBe('Delegated and own access');
    expect(accessModelLabel(content, 'unknown')).toBeNull();
    expect(accessModelLabel(content, null)).toBeNull();
    expect(accessModelLabel(content, undefined)).toBeNull();
  });
});
