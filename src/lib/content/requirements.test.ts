import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import {
  baselineRequirements,
  byProductArea,
  capabilityRequirements,
  itemStatus,
  summarizeStatuses,
} from './requirements.ts';
import type { Answers } from './schemas.ts';

const item = (id: string) => {
  const found = content.requirements
    .flatMap((set) => set.items)
    .find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Missing requirement item ${id}`);
  return found;
};

describe('itemStatus', () => {
  it('is to confirm when there are no answers, or no question behind the item', () => {
    expect(itemStatus(item('mde-active-mode'), null)).toBe('unknown');
    expect(itemStatus(item('admin-role'), { defenderEndpoint: 'most' })).toBe('unknown');
  });

  it.each([
    ['most', 'ready'],
    ['some', 'gap'],
    ['none', 'gap'],
  ])('reads Defender for Endpoint coverage "%s" as %s', (answer, status) => {
    expect(itemStatus(item('mde-active-mode'), { defenderEndpoint: answer })).toBe(status);
  });

  it('keeps an unanswered question as to confirm, never as a gap', () => {
    expect(itemStatus(item('mde-active-mode'), {})).toBe('unknown');
    expect(itemStatus(item('mde-active-mode'), { defenderEndpoint: null })).toBe('unknown');
  });

  describe('the Entra license (E7, or Agent 365 with Entra P1 or Microsoft 365 E3)', () => {
    const entra = item('entra-license');
    const status = (answers: Answers) => itemStatus(entra, answers);

    it('is in place with Microsoft 365 E7', () => {
      expect(status({ basePlan: 'm365-e7' })).toBe('ready');
    });

    it('is in place with an assigned Agent 365 license and Entra P1', () => {
      expect(status({ basePlan: 'm365-e5', agent365Status: 'some-users', entraP1: 'yes' })).toBe(
        'ready',
      );
      expect(status({ basePlan: 'm365-e3', agent365Status: 'broad' })).toBe('ready');
    });

    it('is a gap without an assigned Agent 365 license on a plan other than E7', () => {
      expect(status({ basePlan: 'm365-e5', agent365Status: 'none' })).toBe('gap');
    });

    it('is to confirm while the Agent 365 assignment is unanswered', () => {
      expect(status({ basePlan: 'm365-e5', entraP1: 'yes' })).toBe('unknown');
    });
  });
});

describe('baselineRequirements', () => {
  it('lists the license, the first licensed user, the plan prerequisites and accepting the terms', () => {
    expect(baselineRequirements(content, null).map((view) => view.item.id)).toEqual([
      'agent-365-license',
      'one-licensed-user',
      'plan-prerequisites',
      'accept-terms',
    ]);
  });

  it('reads the Agent 365 license from the plan or the assignment', () => {
    const license = (answers: Answers) =>
      baselineRequirements(content, answers).find((view) => view.item.id === 'agent-365-license')
        ?.status;
    expect(license({ basePlan: 'm365-e7' })).toBe('ready');
    expect(license({ basePlan: 'm365-e5', agent365Status: 'trial' })).toBe('ready');
    expect(license({ basePlan: 'm365-e5', agent365Status: 'none' })).toBe('gap');
  });

  it('is in place for one licensed user when any Agent 365 license is assigned, and a gap when none is', () => {
    const first = (answers: Answers) =>
      baselineRequirements(content, answers).find((view) => view.item.id === 'one-licensed-user')
        ?.status;
    expect(first({ basePlan: 'm365-e5', agent365Status: 'some-users' })).toBe('ready');
    expect(first({ basePlan: 'm365-e5', agent365Status: 'none' })).toBe('gap');
  });
});

describe('capabilityRequirements', () => {
  const views = capabilityRequirements(content, null);

  it('covers every capability once, in catalog order', () => {
    expect(views.map((view) => view.capability.id)).toEqual(content.capabilities.map((c) => c.id));
  });

  it('gives Shadow AI endpoint agent sync its Defender service, its Frontier enrollment and the Shadow AI prerequisites', () => {
    const view = views.find((v) => v.capability.id === 'defender-shadow-ai');
    expect(view?.items.map((entry) => entry.item.id)).toEqual([
      'mde-active-mode',
      'openclaw-frontier',
      'shadow-ai-license',
      'shadow-ai-intune',
      'shadow-ai-agents',
      'shadow-ai-gsa',
      'shadow-ai-roles',
    ]);
    expect(view?.without.map((entry) => entry.id)).toContain('defender-without-e5');
  });

  it('shares one set across several capabilities', () => {
    for (const id of [
      'purview-dlp',
      'purview-insider-risk',
      'purview-dlm',
      'purview-ai-compliance',
    ])
      expect(views.find((v) => v.capability.id === id)?.items.map((e) => e.item.id)).toContain(
        'policy-inclusion',
      );
  });

  it('leaves a capability with no stated requirement empty rather than inventing one', () => {
    const empty = views.filter((view) => view.items.length === 0 && view.without.length === 0);
    expect(empty.length).toBeGreaterThan(0);
  });

  it('marks every item to confirm when there is no assessment', () => {
    for (const view of views) for (const entry of view.items) expect(entry.status).toBe('unknown');
  });

  it('evaluates items against an assessment', () => {
    const answers: Answers = { defenderEndpoint: 'some', frontierProgram: 'enrolled' };
    const view = capabilityRequirements(content, answers).find(
      (v) => v.capability.id === 'defender-shadow-ai',
    );
    const status = Object.fromEntries(
      view?.items.map((entry) => [entry.item.id, entry.status]) ?? [],
    );
    expect(status).toMatchObject({
      'mde-active-mode': 'gap',
      'openclaw-frontier': 'ready',
      'shadow-ai-license': 'unknown',
    });
  });

  it('needs Microsoft 365 E5 to view Shadow AI, and counts E7 as covering it', () => {
    const license = (basePlan: string) =>
      capabilityRequirements(content, { basePlan })
        .find((v) => v.capability.id === 'defender-shadow-ai')
        ?.items.find((entry) => entry.item.id === 'shadow-ai-license')?.status;
    expect(license('m365-e5')).toBe('ready');
    expect(license('m365-e7')).toBe('ready');
    expect(license('m365-e3')).toBe('gap');
  });

  it('reads the sponsor requirement from the sponsor answer', () => {
    const sponsor = (answer: string) =>
      capabilityRequirements(content, { sponsor: answer })
        .find((v) => v.capability.id === 'entra-sponsor-lifecycle')
        ?.items.find((entry) => entry.item.id === 'sponsor-required')?.status;
    expect(sponsor('yes')).toBe('ready');
    expect(sponsor('not-yet')).toBe('gap');
  });
});

describe('summarizeStatuses', () => {
  it('counts each status', () => {
    const counts = summarizeStatuses(
      baselineRequirements(content, { basePlan: 'm365-e7', securitySuites: 'no' }),
    );
    expect(counts.ready + counts.gap + counts.unknown).toBe(4);
    expect(counts.ready).toBeGreaterThanOrEqual(3);
  });
});

describe('byProductArea', () => {
  const groups = byProductArea(content, capabilityRequirements(content, null));

  it('groups capabilities by the area that configures them, in console order', () => {
    const orders = groups.map((group) => group.console.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('keeps every capability in exactly one group', () => {
    expect(groups.flatMap((g) => g.views.map((v) => v.capability.id)).sort()).toEqual(
      content.capabilities.map((c) => c.id).sort(),
    );
  });
});
