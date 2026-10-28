import { content, contentMeta } from '../content/index.ts';
import { patternAnswers } from '../engine/evaluate.ts';
import { seededAssumptions } from './assumptions.ts';
import type { Assessment, DiagnosticWorkspace, Organization } from './diagnostic-model.ts';
import { loadDiagnostics, saveDiagnostics, type DiagnosticState } from './diagnostic-storage.ts';

export type SampleResult = { ok: true; assessmentId: string } | { ok: false };

/** The fictional customer, when it is saved in this browser. */
export const sampleCustomer = (data: DiagnosticWorkspace) =>
  data.organizations.find((organization) => organization.sample === true);

/** Each agent starts from a scenario's answers, all marked as assumed, because nobody has confirmed them. */
function freshSample(now: Date): { organization: Organization; agents: Assessment[] } {
  const copy = content.site.ui.sample;
  const stamp = now.toISOString();
  const organization: Organization = {
    id: crypto.randomUUID(),
    sample: true,
    answers: {
      orgName: copy.customerName,
      industry: copy.industry,
      cloudEnvironment: 'commercial',
    },
    contentVersion: contentMeta.contentVersion,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const agents = copy.sampleIds.map((sampleId): Assessment => {
    const sample = content.samples.find((candidate) => candidate.id === sampleId)!;
    const answers = {
      ...patternAnswers(content, sample.patternId, sample.id).useCase,
      useCaseName: sample.title,
    };
    return {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      answers,
      mode: 'quick',
      sectionId: 'profile',
      patternId: sample.patternId,
      sampleId: sample.id,
      assumedQuestionIds: seededAssumptions(answers),
      contentVersion: contentMeta.contentVersion,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
  return { organization, agents };
}

/** The saved workspace with the sample customer and its agents taken out, and nothing else changed. */
function withoutSample(data: DiagnosticWorkspace): DiagnosticWorkspace {
  const gone = new Set(
    data.organizations.filter((organization) => organization.sample === true).map((o) => o.id),
  );
  return {
    ...structuredClone(data),
    organizations: data.organizations.filter((organization) => !gone.has(organization.id)),
    assessments: data.assessments.filter((a) => !gone.has(a.organizationId)),
    revision: crypto.randomUUID(),
  };
}

/** Saved customers can only be changed when they are readable, so a damaged save is never overwritten. */
const writable = (state: DiagnosticState) => state.error === null && state.recoveryRaw === null;

/** Replaces the sample customer, saved or not, with a fresh copy, in a single save. */
function replaceSample(state: DiagnosticState, now: Date): SampleResult {
  const data = withoutSample(state.data);
  const { organization, agents } = freshSample(now);
  data.organizations.push(organization);
  data.assessments.push(...agents);
  return saveDiagnostics(state, data).error === null
    ? { ok: true, assessmentId: agents[0]!.id }
    : { ok: false };
}

/**
 * Saves the fictional sample customer with its agents, once. If it is already saved, nothing changes and its
 * first agent is returned. A sample whose agents were all deleted starts over. Only the sample is read or written.
 */
export function addSampleCustomer(now: Date = new Date()): SampleResult {
  const state = loadDiagnostics();
  if (!writable(state)) return { ok: false };
  const existing = sampleCustomer(state.data);
  const first = state.data.assessments.find((a) => a.organizationId === existing?.id);
  if (first !== undefined) return { ok: true, assessmentId: first.id };
  return replaceSample(state, now);
}

/** Puts the sample customer back to its original answers, discarding any edits made to it. */
export function resetSampleCustomer(now: Date = new Date()): SampleResult {
  const state = loadDiagnostics();
  return writable(state) ? replaceSample(state, now) : { ok: false };
}

/** Removes the sample customer and its agents, and nothing else. Returns false when it could not be saved. */
export function removeSampleCustomer(): boolean {
  const state = loadDiagnostics();
  if (!writable(state)) return false;
  if (sampleCustomer(state.data) === undefined) return true;
  return saveDiagnostics(state, withoutSample(state.data)).error === null;
}
