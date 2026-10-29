import { content, contentMeta } from '../content/index.ts';
import { seededAssumptions } from './assumptions.ts';
import type { Assessment, DiagnosticWorkspace } from './diagnostic-model.ts';
import { loadDiagnostics, saveDiagnostics } from './diagnostic-storage.ts';
import { touched } from './workspace.ts';

/** The choice that makes a new customer instead of adding the agent to a saved one. */
export const NEW_CUSTOMER = 'new';

export type StartResult = { ok: true; assessmentId: string } | { ok: false };

/**
 * The customer an example agent goes to unless the seller says otherwise: the real customer touched most
 * recently. The fictional sample customer is never chosen for them, so a seller's own work cannot end up in
 * something that is removed in one click.
 */
export function defaultCustomerId(data: DiagnosticWorkspace): string {
  const real = data.organizations
    .filter((organization) => organization.sample !== true)
    .map((organization) => ({
      id: organization.id,
      at: touched(
        organization,
        data.assessments.filter((a) => a.organizationId === organization.id),
      ),
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return real[0]?.id ?? NEW_CUSTOMER;
}

/**
 * Saves an example agent as one of a customer's agents. Its answers all start as assumptions, because nobody has
 * confirmed them with the customer. A new customer has no name yet and starts in the commercial cloud, as in the
 * agent passport. Only a readable save is changed, so a damaged one is never overwritten.
 */
export function startFromExample(
  input: { patternId: string; sampleId?: string; customerId: string },
  now: Date = new Date(),
): StartResult {
  const state = loadDiagnostics();
  if (state.error !== null || state.recoveryRaw !== null) return { ok: false };
  const pattern = content.patterns.find((candidate) => candidate.id === input.patternId);
  const sample =
    input.sampleId === undefined
      ? undefined
      : content.samples.find(
          (candidate) => candidate.id === input.sampleId && candidate.patternId === input.patternId,
        );
  if (pattern === undefined || (input.sampleId !== undefined && sample === undefined))
    return { ok: false };

  const stamp = now.toISOString();
  const data = structuredClone(state.data);
  let organization = data.organizations.find((candidate) => candidate.id === input.customerId);
  if (organization === undefined) {
    organization = {
      id: crypto.randomUUID(),
      answers: { cloudEnvironment: 'commercial' },
      contentVersion: contentMeta.contentVersion,
      createdAt: stamp,
      updatedAt: stamp,
    };
    data.organizations.push(organization);
  }
  const answers = {
    ...pattern.answers,
    ...sample?.answers,
    useCaseName: sample?.title ?? pattern.title,
  };
  const assessment: Assessment = {
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers,
    mode: 'quick',
    sectionId: 'profile',
    patternId: pattern.id,
    sampleId: sample?.id ?? null,
    assumedQuestionIds: seededAssumptions(answers),
    contentVersion: contentMeta.contentVersion,
    createdAt: stamp,
    updatedAt: stamp,
  };
  data.assessments.push(assessment);
  data.revision = crypto.randomUUID();
  return saveDiagnostics(state, data).error === null
    ? { ok: true, assessmentId: assessment.id }
    : { ok: false };
}
