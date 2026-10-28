import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import type { Answers } from '../content/schemas.ts';
import { byUrgency, evaluateGuardrails } from './guardrails.ts';

const plan = (answers: Answers | null) => evaluateGuardrails(content, answers);
const find = (answers: Answers | null, id: string) =>
  plan(answers)
    .gates.flatMap((gate) => gate.items)
    .find((view) => view.item.id === id);

describe('evaluateGuardrails', () => {
  it('groups the checklist into the three gates, in the order they are written', () => {
    const result = plan({});
    expect(result.gates.map((view) => view.gate.id)).toEqual(['pilot', 'production', 'scale']);
    for (const view of result.gates)
      for (const entry of view.items) expect(entry.item.gate).toBe(view.gate.id);
  });

  it('counts each shown guardrail once', () => {
    const cases: (Answers | null)[] = [null, {}, { sponsor: 'yes', agent365Status: 'none' }];
    for (const answers of cases) {
      const result = plan(answers);
      const shown = result.gates.flatMap((gate) => gate.items).length;
      expect(result.total).toBe(shown);
      expect(result.counts.ready + result.counts.gap + result.counts.unknown).toBe(shown);
    }
  });

  it('keeps every guardrail the answers cannot rule out, and marks the conditional ones', () => {
    const result = plan(null);
    expect(result.total).toBe(content.guardrails.items.length);
    expect(find(null, 'protect-data')?.applies).toBeNull();
    expect(find(null, 'registered-owner')?.applies).toBe(true);
  });

  it('leaves off a guardrail the answers rule out, and brings it back when they do not', () => {
    expect(find({ dataSensitivity: 'internal' }, 'protect-data')).toBeUndefined();
    expect(find({ dataSensitivity: 'confidential' }, 'protect-data')?.applies).toBe(true);
    expect(find({ accessModel: 'delegated' }, 'frontier-enrollment')).toBeUndefined();
    expect(find({ accessModel: 'own-teammate' }, 'frontier-enrollment')?.applies).toBe(true);
  });

  it.each([
    ['licensed-people', { agent365Status: 'broad' }, 'ready'],
    ['licensed-people', { agent365Status: 'some-users' }, 'ready'],
    ['licensed-people', { agent365Status: 'none' }, 'gap'],
    ['licensed-people', {}, 'unknown'],
    ['registered-owner', { sponsor: 'yes' }, 'ready'],
    ['registered-owner', { sponsor: 'not-yet' }, 'gap'],
    ['registered-owner', {}, 'unknown'],
    ['frontier-enrollment', { accessModel: 'own-teammate', frontierProgram: 'enrolled' }, 'ready'],
    [
      'frontier-enrollment',
      { accessModel: 'own-teammate', frontierProgram: 'not-enrolled' },
      'gap',
    ],
    ['frontier-enrollment', { accessModel: 'own-teammate' }, 'unknown'],
  ] as const)('%s with %j is %s', (id, answers, status) => {
    expect(find(answers, id)?.status).toBe(status);
  });

  it('never counts an unanswered question as a gap, and shows a guardrail without a done-condition as confirm', () => {
    const answered = plan({});
    expect(answered.counts.gap).toBe(0);
    const withoutDone = content.guardrails.items.find((item) => item.doneWhen === undefined)!;
    expect(find({}, withoutDone.id)?.status).toBe('unknown');
  });

  it('does not call a guardrail a gap while the answers cannot say whether it applies', () => {
    // The labels program is not started, but nobody has said how sensitive the data is.
    const undecided = find({ labelsProgram: 'not-yet' }, 'protect-data');
    expect(undecided).toMatchObject({ applies: null, status: 'unknown' });
    expect(plan({ labelsProgram: 'not-yet' }).counts.gap).toBe(0);
    // Once the data is confidential, the same answer is a real gap.
    expect(
      find({ labelsProgram: 'not-yet', dataSensitivity: 'confidential' }, 'protect-data'),
    ).toMatchObject({ applies: true, status: 'gap' });
    // And a guardrail the answers rule out is left off, whatever the done-condition says.
    expect(
      find({ labelsProgram: 'not-yet', dataSensitivity: 'internal' }, 'protect-data'),
    ).toBeUndefined();
  });

  it('orders gaps first, then what to confirm, then what is in place, keeping the written order', () => {
    const items = plan({ sponsor: 'yes', agent365Status: 'none' }).gates.flatMap(
      (gate) => gate.items,
    );
    const ordered = byUrgency(items);
    const rank = { gap: 0, unknown: 1, ready: 2 };
    expect(ordered.map((view) => rank[view.status])).toEqual(
      [...ordered.map((view) => rank[view.status])].sort((a, b) => a - b),
    );
    for (const status of ['gap', 'unknown', 'ready'] as const)
      expect(ordered.filter((view) => view.status === status)).toEqual(
        items.filter((view) => view.status === status),
      );
    expect(ordered).toHaveLength(items.length);
    expect(items.map((view) => view.status)).not.toEqual(ordered.map((view) => view.status));
  });

  it('is deterministic for the same answers', () => {
    const answers = { sponsor: 'yes', tools: ['web-browsing'], agentEstate: 'dozens' };
    expect(plan(answers)).toEqual(plan(structuredClone(answers)));
  });
});
