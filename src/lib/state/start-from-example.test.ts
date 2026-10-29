import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content/index.ts';
import { DiagnosticWorkspaceSchema } from './diagnostic-model.ts';
import { DIAGNOSTIC_STORAGE_KEY, loadDiagnostics, saveDiagnostics } from './diagnostic-storage.ts';
import { addSampleCustomer } from './sample.ts';
import { defaultCustomerId, NEW_CUSTOMER, startFromExample } from './start-from-example.ts';
import { STORAGE_PREFIX } from './storage.ts';

const key = STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY;
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

const pattern = content.patterns.find((p) => p.id === 'customer-agent')!;
const sample = content.samples[0]!;

/** A real customer with one agent, saved the way the passport saves it. */
function saveRealCustomer(name: string, updatedAt: string) {
  const state = loadDiagnostics();
  const data = structuredClone(state.data);
  const organizationId = crypto.randomUUID();
  data.organizations.push({
    id: organizationId,
    createdAt: updatedAt,
    updatedAt,
    contentVersion: 'v1',
    answers: { orgName: name, cloudEnvironment: 'gcc' },
  });
  data.assessments.push({
    id: crypto.randomUUID(),
    organizationId,
    createdAt: updatedAt,
    updatedAt,
    contentVersion: 'v1',
    answers: { useCaseName: `${name} agent` },
    mode: 'quick',
    sectionId: 'profile',
    patternId: null,
    sampleId: null,
  });
  expect(saveDiagnostics(state, data).error).toBeNull();
  return organizationId;
}

describe('starting an agent from an example', () => {
  it("saves the example as a new customer's agent, with every answer marked as assumed", () => {
    const result = startFromExample(
      { patternId: pattern.id, customerId: NEW_CUSTOMER },
      new Date('2026-10-27T09:00:00.000Z'),
    );
    expect(result.ok).toBe(true);
    const { data } = loadDiagnostics();
    expect(DiagnosticWorkspaceSchema.safeParse(data).success).toBe(true);
    expect(data.organizations).toHaveLength(1);
    // A new customer has no name yet and starts in the commercial cloud, as in the passport.
    expect(data.organizations[0]!.answers).toEqual({ cloudEnvironment: 'commercial' });
    expect(data.organizations[0]!.sample).toBeUndefined();
    const agent = data.assessments[0]!;
    expect(result.ok && result.assessmentId).toBe(agent.id);
    expect(agent.organizationId).toBe(data.organizations[0]!.id);
    expect(agent.answers).toEqual({ ...pattern.answers, useCaseName: pattern.title });
    expect(agent.patternId).toBe(pattern.id);
    expect(agent.sampleId).toBeNull();
    expect(agent.mode).toBe('quick');
    // The name is a title, not an assumption about the agent. Everything else is one.
    expect([...(agent.assumedQuestionIds ?? [])].sort()).toEqual(
      Object.keys(pattern.answers)
        .filter((id) => id !== 'useCaseName')
        .sort(),
    );
    expect(agent.createdAt).toBe('2026-10-27T09:00:00.000Z');
  });

  it('adds the agent to the customer it is for, and leaves that customer and its agents as they were', () => {
    const customerId = saveRealCustomer('Fictional customer', '2026-10-01T09:00:00.000Z');
    const before = loadDiagnostics().data;
    const result = startFromExample({ patternId: pattern.id, customerId });
    expect(result.ok).toBe(true);
    const { data } = loadDiagnostics();
    expect(data.organizations).toEqual(before.organizations);
    expect(data.assessments).toHaveLength(2);
    expect(data.assessments.slice(0, 1)).toEqual(before.assessments);
    expect(data.assessments[1]!.organizationId).toBe(customerId);
  });

  it('starts a second customer when asked, even when one is saved', () => {
    saveRealCustomer('Fictional customer', '2026-10-01T09:00:00.000Z');
    expect(startFromExample({ patternId: pattern.id, customerId: NEW_CUSTOMER }).ok).toBe(true);
    expect(loadDiagnostics().data.organizations).toHaveLength(2);
  });

  it("uses a sample's title and answers over its example's, and remembers both", () => {
    const result = startFromExample({
      patternId: sample.patternId,
      sampleId: sample.id,
      customerId: NEW_CUSTOMER,
    });
    expect(result.ok).toBe(true);
    const agent = loadDiagnostics().data.assessments[0]!;
    const base = content.patterns.find((p) => p.id === sample.patternId)!;
    expect(agent.answers).toEqual({
      ...base.answers,
      ...sample.answers,
      useCaseName: sample.title,
    });
    expect(agent.patternId).toBe(sample.patternId);
    expect(agent.sampleId).toBe(sample.id);
  });

  it('refuses an example that does not exist and a sample that belongs to another one', () => {
    expect(startFromExample({ patternId: 'not-an-example', customerId: NEW_CUSTOMER }).ok).toBe(
      false,
    );
    const other = content.patterns.find((p) => p.id !== sample.patternId)!;
    expect(
      startFromExample({ patternId: other.id, sampleId: sample.id, customerId: NEW_CUSTOMER }).ok,
    ).toBe(false);
    expect(values.has(key)).toBe(false);
  });

  it('does not write over a save it cannot read, and says it could not save when storage is full', () => {
    values.set(key, '{ not json');
    expect(startFromExample({ patternId: pattern.id, customerId: NEW_CUSTOMER }).ok).toBe(false);
    expect(values.get(key)).toBe('{ not json');
    values.clear();
    failWrites = true;
    expect(startFromExample({ patternId: pattern.id, customerId: NEW_CUSTOMER }).ok).toBe(false);
    expect(values.has(key)).toBe(false);
  });
});

describe('the customer an example goes to by default', () => {
  it('is a new customer before anything is saved', () => {
    expect(defaultCustomerId(loadDiagnostics().data)).toBe(NEW_CUSTOMER);
  });

  it('is the real customer touched most recently', () => {
    saveRealCustomer('Fictional older customer', '2026-10-01T09:00:00.000Z');
    const newer = saveRealCustomer('Fictional newer customer', '2026-10-05T09:00:00.000Z');
    expect(defaultCustomerId(loadDiagnostics().data)).toBe(newer);
  });

  it('is never the sample customer, which can be removed in one click', () => {
    expect(addSampleCustomer().ok).toBe(true);
    expect(defaultCustomerId(loadDiagnostics().data)).toBe(NEW_CUSTOMER);
    const real = saveRealCustomer('Fictional real customer', '2026-01-01T09:00:00.000Z');
    expect(defaultCustomerId(loadDiagnostics().data)).toBe(real);
  });
});
