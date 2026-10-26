import { z } from 'zod';
import { AnswersSchema } from '../content/schemas.ts';
import { LogoSchema } from './logo.ts';

const Entity = {
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  contentVersion: z.string().min(1),
};
export const OrganizationSchema = z.strictObject({ ...Entity, answers: AnswersSchema });
export const AssessmentSchema = z.strictObject({
  ...Entity,
  organizationId: z.uuid(),
  answers: AnswersSchema,
  mode: z.enum(['quick', 'full']),
  sectionId: z.string().min(1),
  patternId: z.string().nullable(),
  sampleId: z.string().nullable(),
  logo: LogoSchema.optional(),
});
export const DiagnosticWorkspaceSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    revision: z.uuid(),
    organizations: z.array(OrganizationSchema),
    assessments: z.array(AssessmentSchema),
  })
  .superRefine((workspace, ctx) => {
    const orgIds = new Set(workspace.organizations.map((o) => o.id));
    if (orgIds.size !== workspace.organizations.length)
      ctx.addIssue({ code: 'custom', message: 'duplicate organization ids' });
    if (new Set(workspace.assessments.map((a) => a.id)).size !== workspace.assessments.length)
      ctx.addIssue({ code: 'custom', message: 'duplicate assessment ids' });
    if (workspace.assessments.some((a) => !orgIds.has(a.organizationId)))
      ctx.addIssue({ code: 'custom', message: 'assessment references a missing organization' });
  });
export type Organization = z.infer<typeof OrganizationSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type DiagnosticWorkspace = z.infer<typeof DiagnosticWorkspaceSchema>;
export type DiagnosticMode = Assessment['mode'];

export function emptyWorkspace(): DiagnosticWorkspace {
  return { schemaVersion: 1, revision: crypto.randomUUID(), organizations: [], assessments: [] };
}

export function displayName(
  answers: Organization['answers'],
  key: 'orgName' | 'useCaseName',
  fallback: string,
): string {
  const name = answers[key];
  return typeof name === 'string' && name.trim() !== '' && name !== 'unknown'
    ? name.trim()
    : fallback;
}
