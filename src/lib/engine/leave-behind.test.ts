import { describe, expect, it } from 'vitest';
import { content, contentMeta } from '../content/index.ts';
import {
  CONTROL_LIMIT,
  QUESTION_LIMIT,
  STEP_LIMIT,
  buildLeaveBehind,
  stepLimit,
} from './leave-behind.ts';

const version = contentMeta.contentVersion;
const org = { cloudEnvironment: 'commercial' };
const six = {
  accessModel: 'own-teammate',
  buildPlatform: 'microsoft-foundry',
  dataSensitivity: 'confidential',
  tools: ['microsoft-mcp'],
  autonomy: 'approval-gated',
  audience: ['employees'],
};
const ask = (id: string) => content.questions.find((question) => question.id === id)!.ifUnknown;

describe('buildLeaveBehind', () => {
  const plan = buildLeaveBehind(content, { org, useCase: { ...six, stage: 'pilot' } }, version);

  it('says why it matters with the statements named in the content, each with its source', () => {
    expect(plan.why.map((statement) => statement.id)).toEqual(content.leaveBehind.whyStatementIds);
    for (const statement of plan.why) expect(statement.sourceIds.length).toBeGreaterThan(0);
  });

  it('shows the gates that matter at this stage, and leaves out one with nothing to say', () => {
    expect(plan.stage).toBe('pilot');
    const ids = plan.steps.map((step) => step.gate.id);
    expect(ids).not.toContain('scale');
    expect(ids).toContain('pilot');
    for (const step of plan.steps) expect(step.items.length).toBeGreaterThan(0);
    const scaling = buildLeaveBehind(
      content,
      { org, useCase: { ...six, stage: 'scaling' } },
      version,
    );
    expect(scaling.steps.map((step) => step.gate.id)).toContain('scale');
  });

  it('lists each gate with gaps first, then what is to confirm, then what is in place', () => {
    const rank = { gap: 0, unknown: 1, ready: 2 } as const;
    for (const step of plan.steps) {
      const ranks = step.items.map((view) => rank[view.status]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('splits the people to license by how much Microsoft asks of them', () => {
    expect(plan.license.required.map((view) => view.population.id)).toContain('own-access-owners');
    for (const view of plan.license.required) expect(view.population.need).toBe('required');
    for (const view of plan.license.recommended) expect(view.population.need).toBe('recommended');
  });

  it('collects what is not confirmed on one list, once each, and never as a statement', () => {
    expect(new Set(plan.questions).size).toBe(plan.questions.length);
    const asks = plan.passport.requirements
      .filter((view) => view.status === 'unknown' && view.item.askPrompt !== undefined)
      .map((view) => view.item.askPrompt);
    for (const prompt of asks) expect(plan.questions).toContain(prompt);
    const open = content.licensing.who.populations.filter((p) => p.need === 'not-stated');
    expect(open.length).toBeGreaterThan(0);
  });

  it('asks about each of the six questions the seller left open, and only those', () => {
    const left = buildLeaveBehind(
      content,
      { org, useCase: { ...six, autonomy: 'unknown', tools: null, stage: 'pilot' } },
      version,
    );
    expect(left.questions).toContain(ask('autonomy'));
    expect(left.questions).toContain(ask('tools'));
    expect(left.questions).not.toContain(ask('accessModel'));
    expect(plan.questions).not.toContain(ask('autonomy'));
  });

  it('puts the unanswered questions first, because they decide the rest', () => {
    const left = buildLeaveBehind(content, { org, useCase: { stage: 'pilot' } }, version);
    const first = left.questions.slice(0, 6);
    for (const id of [
      'accessModel',
      'buildPlatform',
      'dataSensitivity',
      'tools',
      'autonomy',
      'audience',
    ])
      expect(first).toContain(ask(id));
  });

  it('works with nothing answered: nothing to license yet and every question open', () => {
    const empty = buildLeaveBehind(content, { org: {}, useCase: {} }, version);
    expect(empty.stage).toBeNull();
    expect(empty.license).toEqual({ required: [], recommended: [] });
    expect(empty.questions.length).toBeGreaterThanOrEqual(6);
    expect(empty.steps.length).toBeGreaterThan(0);
  });

  it('cites each source once, and every one is a source of this site', () => {
    expect(new Set(plan.sourceIds).size).toBe(plan.sourceIds.length);
    const known = new Set(content.sources.map((source) => source.id));
    for (const id of plan.sourceIds) expect(known.has(id)).toBe(true);
  });

  it('fits a page: the limits are small and positive, and a third gate shows one step fewer', () => {
    expect(CONTROL_LIMIT).toBeGreaterThan(0);
    expect(STEP_LIMIT).toBeGreaterThan(1);
    expect(QUESTION_LIMIT).toBeGreaterThan(STEP_LIMIT);
    expect(stepLimit(0)).toBe(STEP_LIMIT);
    expect(stepLimit(2)).toBe(STEP_LIMIT);
    expect(stepLimit(3)).toBe(STEP_LIMIT - 1);
    const scaling = buildLeaveBehind(
      content,
      { org, useCase: { ...six, stage: 'scaling' } },
      version,
    );
    expect(scaling.steps).toHaveLength(3);
  });
});
