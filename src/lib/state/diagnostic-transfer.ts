import { z } from 'zod';
import { DiagnosticWorkspaceSchema, type DiagnosticWorkspace } from './diagnostic-model.ts';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/** The format id written to every new backup. It names the app. */
export const BUNDLE_FORMAT = 'a365-explorer';
/**
 * Backups made under an earlier name carry that name, and people keep them. An id is never removed, so they
 * still import; new backups always use BUNDLE_FORMAT.
 */
const LEGACY_BUNDLE_FORMATS = ['a365-capability-explorer'] as const;
export const DiagnosticBundleSchema = z.strictObject({
  format: z.enum([BUNDLE_FORMAT, ...LEGACY_BUNDLE_FORMATS]),
  formatVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  contentVersion: z.string().min(1),
  workspace: DiagnosticWorkspaceSchema,
});
export type DiagnosticBundle = z.infer<typeof DiagnosticBundleSchema>;
export type ImportFailure = 'size' | 'json' | 'format' | 'read';
export type ImportResult =
  { ok: true; bundle: DiagnosticBundle } | { ok: false; error: ImportFailure };

export function parseDiagnosticBundle(raw: string): ImportResult {
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES)
    return { ok: false, error: 'size' };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, error: 'json' };
  }
  const parsed = DiagnosticBundleSchema.safeParse(value);
  return parsed.success ? { ok: true, bundle: parsed.data } : { ok: false, error: 'format' };
}

export function diagnosticBundle(
  workspace: DiagnosticWorkspace,
  contentVersion: string,
  assessmentId?: string | readonly string[],
): DiagnosticBundle {
  const data = structuredClone(workspace);
  if (assessmentId !== undefined) {
    const ids = typeof assessmentId === 'string' ? [assessmentId] : assessmentId;
    const selected = new Set(ids);
    data.assessments = data.assessments.filter((a) => selected.has(a.id));
    if (selected.size !== ids.length) throw new Error('Cannot export duplicate assessments');
    if (data.assessments.length !== ids.length)
      throw new Error('Cannot export an assessment that does not exist');
    const organizations = new Set(data.assessments.map((a) => a.organizationId));
    data.organizations = data.organizations.filter((o) => organizations.has(o.id));
  }
  return DiagnosticBundleSchema.parse({
    format: BUNDLE_FORMAT,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    contentVersion,
    workspace: data,
  });
}

/** Imported entities always get new ids; matching names or ids never overwrite local work. */
export function appendDiagnosticBundle(
  current: DiagnosticWorkspace,
  bundle: DiagnosticBundle,
): DiagnosticWorkspace {
  const incoming = DiagnosticBundleSchema.parse(bundle).workspace;
  const next = structuredClone(DiagnosticWorkspaceSchema.parse(current));
  const ids = new Map(incoming.organizations.map((o) => [o.id, crypto.randomUUID()]));
  next.organizations.push(...incoming.organizations.map((o) => ({ ...o, id: ids.get(o.id)! })));
  next.assessments.push(
    ...incoming.assessments.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
      organizationId: ids.get(a.organizationId)!,
    })),
  );
  next.revision = crypto.randomUUID();
  return DiagnosticWorkspaceSchema.parse(next);
}
