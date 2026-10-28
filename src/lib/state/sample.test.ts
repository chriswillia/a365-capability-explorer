import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content/index.ts';
import { DiagnosticWorkspaceSchema, type Assessment } from './diagnostic-model.ts';
import { DIAGNOSTIC_STORAGE_KEY, loadDiagnostics, saveDiagnostics } from './diagnostic-storage.ts';
import {
  addSampleCustomer,
  removeSampleCustomer,
  resetSampleCustomer,
  sampleCustomer,
} from './sample.ts';
import { STORAGE_PREFIX } from './storage.ts';

const key = STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY;
const copy = content.site.ui.sample;
let values: Map<string, string>;
let failWrites = false;
beforeEach(() => {
  values = new Map();
  failWrites = false;
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWrites) throw new DOMException('full', 'QuotaExceededError');
        values.set(k, v);
      },
      removeItem: (k: string) => values.delete(k),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

/** A real customer with one agent, saved the way the diagnostic saves it. */
function saveRealCustomer() {
  const state = loadDiagnostics();
  const data = structuredClone(state.data);
  const now = '2026-10-26T12:00:00.000Z';
  const organizationId = crypto.randomUUID();
  data.organizations.push({
    id: organizationId,
    createdAt: now,
    updatedAt: now,
    contentVersion: 'v1',
    answers: { orgName: 'Fictional real customer', cloudEnvironment: 'gcc' },
  });
  data.assessments.push({
    id: crypto.randomUUID(),
    organizationId,
    createdAt: now,
    updatedAt: now,
    contentVersion: 'v1',
    answers: { useCaseName: 'Fictional real agent', stage: 'production' },
    mode: 'full',
    sectionId: 'build',
    patternId: null,
    sampleId: null,
  });
  expect(saveDiagnostics(state, data).error).toBeNull();
  return { organizationId, data: loadDiagnostics().data };
}

const sampleAgents = (assessments: Assessment[], organizationId: string) =>
  assessments.filter((a) => a.organizationId === organizationId);

describe('the sample customer', () => {
  it('saves a fictional customer with one agent per scenario, started from that scenario', () => {
    const result = addSampleCustomer(new Date('2026-10-27T09:00:00.000Z'));
    const { data } = loadDiagnostics();
    expect(DiagnosticWorkspaceSchema.safeParse(data).success).toBe(true);
    const customer = sampleCustomer(data)!;
    expect(customer.sample).toBe(true);
    expect(customer.answers.orgName).toBe(copy.customerName);
    expect(customer.answers.cloudEnvironment).toBe('commercial');
    const agents = sampleAgents(data.assessments, customer.id);
    expect(agents.map((a) => a.sampleId)).toEqual(copy.sampleIds);
    for (const agent of agents) {
      const scenario = content.samples.find((s) => s.id === agent.sampleId)!;
      expect(agent.patternId).toBe(scenario.patternId);
      expect(agent.answers.useCaseName).toBe(scenario.title);
      expect(agent.createdAt).toBe('2026-10-27T09:00:00.000Z');
      // Nobody has confirmed these answers with a customer, so the agents say so.
      expect(agent.assumedQuestionIds?.length ?? 0).toBeGreaterThan(0);
      expect(agent.assumedQuestionIds).not.toContain('useCaseName');
    }
    expect(result).toEqual({ ok: true, assessmentId: agents[0]!.id });
  });

  it('shows the access models side by side: someone else’s access and the agent’s own', () => {
    const accessModels = copy.sampleIds.map((id) => {
      const pattern = content.patterns.find(
        (p) => p.id === content.samples.find((s) => s.id === id)!.patternId,
      )!;
      return String(pattern.answers.accessModel);
    });
    expect(accessModels).toContain('delegated');
    expect(accessModels.some((model) => model.startsWith('own-'))).toBe(true);
  });

  it('is saved once: loading it again changes nothing and opens the first agent', () => {
    const first = addSampleCustomer();
    const saved = values.get(key);
    const second = addSampleCustomer();
    expect(second).toEqual(first);
    expect(values.get(key)).toBe(saved);
    expect(loadDiagnostics().data.organizations.filter((o) => o.sample === true)).toHaveLength(1);
  });

  it('never touches a real customer when it is added, reset or removed', () => {
    const real = saveRealCustomer();
    const realRows = (data: typeof real.data) => ({
      organizations: data.organizations.filter((o) => o.sample !== true),
      assessments: data.assessments.filter((a) => a.organizationId === real.organizationId),
    });
    const before = realRows(real.data);

    addSampleCustomer();
    expect(realRows(loadDiagnostics().data)).toEqual(before);
    expect(loadDiagnostics().data.organizations).toHaveLength(2);

    expect(resetSampleCustomer().ok).toBe(true);
    expect(realRows(loadDiagnostics().data)).toEqual(before);
    expect(loadDiagnostics().data.organizations).toHaveLength(2);

    expect(removeSampleCustomer()).toBe(true);
    const after = loadDiagnostics().data;
    expect(sampleCustomer(after)).toBeUndefined();
    expect(realRows(after)).toEqual(before);
    expect(after.organizations).toHaveLength(1);
    expect(after.assessments).toHaveLength(1);
  });

  it('removes the customer and every one of its agents', () => {
    addSampleCustomer();
    expect(removeSampleCustomer()).toBe(true);
    const { data } = loadDiagnostics();
    expect(data.organizations).toEqual([]);
    expect(data.assessments).toEqual([]);
  });

  it('removes nothing, and writes nothing, when it was never loaded', () => {
    expect(removeSampleCustomer()).toBe(true);
    expect(values.has(key)).toBe(false);
  });

  it('puts the original answers back on reset, in a single save', () => {
    const { assessmentId } = addSampleCustomer() as { ok: true; assessmentId: string };
    const state = loadDiagnostics();
    const edited = structuredClone(state.data);
    edited.assessments.find((a) => a.id === assessmentId)!.answers = { useCaseName: 'Edited' };
    expect(saveDiagnostics(state, edited).error).toBeNull();
    expect(loadDiagnostics().data.assessments.some((a) => a.answers.useCaseName === 'Edited')).toBe(
      true,
    );

    const reset = resetSampleCustomer();
    expect(reset.ok).toBe(true);
    const { data } = loadDiagnostics();
    const customer = sampleCustomer(data)!;
    const agents = sampleAgents(data.assessments, customer.id);
    expect(data.organizations).toHaveLength(1);
    expect(agents.map((a) => a.answers.useCaseName)).toEqual(
      copy.sampleIds.map((id) => content.samples.find((s) => s.id === id)!.title),
    );
    expect(agents.some((a) => a.id === assessmentId)).toBe(false);
    expect(reset).toEqual({ ok: true, assessmentId: agents[0]!.id });
  });

  it('loads the sample on reset even when it was not saved', () => {
    expect(resetSampleCustomer().ok).toBe(true);
    expect(sampleCustomer(loadDiagnostics().data)).toBeDefined();
  });

  it('starts over when every agent of a saved sample was deleted, without a second sample customer', () => {
    addSampleCustomer();
    const state = loadDiagnostics();
    const emptied = structuredClone(state.data);
    emptied.assessments = [];
    expect(saveDiagnostics(state, emptied).error).toBeNull();

    const result = addSampleCustomer();
    expect(result.ok).toBe(true);
    const { data } = loadDiagnostics();
    expect(data.organizations.filter((o) => o.sample === true)).toHaveLength(1);
    expect(data.assessments).toHaveLength(copy.sampleIds.length);
  });

  it('refuses to overwrite a damaged save', () => {
    values.set(key, '{not json');
    expect(addSampleCustomer()).toEqual({ ok: false });
    expect(resetSampleCustomer()).toEqual({ ok: false });
    expect(removeSampleCustomer()).toBe(false);
    expect(values.get(key)).toBe('{not json');
  });

  it('reports a failed save and leaves what was saved as it was', () => {
    const real = saveRealCustomer();
    const saved = values.get(key);
    failWrites = true;
    expect(addSampleCustomer()).toEqual({ ok: false });
    expect(resetSampleCustomer()).toEqual({ ok: false });
    failWrites = false;
    expect(values.get(key)).toBe(saved);
    expect(loadDiagnostics().data.organizations).toEqual(real.data.organizations);
  });

  it('reports a failed removal', () => {
    addSampleCustomer();
    failWrites = true;
    expect(removeSampleCustomer()).toBe(false);
  });
});
