import { describe, expect, it } from 'vitest';
import { emptyWorkspace } from './diagnostic-model.ts';
import {
  appendDiagnosticBundle,
  BUNDLE_FORMAT,
  diagnosticBundle,
  MAX_IMPORT_BYTES,
  parseDiagnosticBundle,
} from './diagnostic-transfer.ts';

function workspace() {
  const data = emptyWorkspace();
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: 'old-content',
  };
  const organizationId = crypto.randomUUID();
  data.organizations.push({ ...entity, id: organizationId, answers: { orgName: 'Test org' } });
  data.assessments.push({
    ...entity,
    id: crypto.randomUUID(),
    organizationId,
    answers: { useCaseName: 'Test case', retiredQuestion: 'preserve for correction' },
    mode: 'full',
    sectionId: 'review',
    patternId: null,
    sampleId: null,
  });
  return data;
}

describe('portable diagnostic bundles', () => {
  it('round trips metadata and answers without modifying the workspace', () => {
    const data = workspace();
    const before = structuredClone(data);
    const bundle = diagnosticBundle(data, 'current-content');
    expect(parseDiagnosticBundle(JSON.stringify(bundle))).toEqual({ ok: true, bundle });
    expect(bundle.workspace).toEqual(data);
    expect(data).toEqual(before);
    expect(bundle.contentVersion).toBe('current-content');
  });
  it('exports only the selected assessment and its organization', () => {
    const first = workspace();
    const combined = appendDiagnosticBundle(first, diagnosticBundle(workspace(), 'v2'));
    const selected = first.assessments[0]!;
    const bundle = diagnosticBundle(combined, 'v2', selected.id);
    expect(bundle.workspace.assessments).toEqual([selected]);
    expect(bundle.workspace.organizations).toEqual(first.organizations);
    expect(() => diagnosticBundle(combined, 'v2', crypto.randomUUID())).toThrow(/does not exist/);
  });
  it('imports copies, remaps relationships and preserves obsolete answers without overwriting', () => {
    const original = workspace();
    const before = structuredClone(original);
    const bundle = diagnosticBundle(original, 'v2');
    const next = appendDiagnosticBundle(original, bundle);
    const again = appendDiagnosticBundle(next, bundle);
    expect(original).toEqual(before);
    expect(next.assessments[0]).toEqual(original.assessments[0]);
    expect(next.assessments[1]!.answers).toEqual(original.assessments[0]!.answers);
    expect(next.assessments[1]!.organizationId).toBe(next.organizations[1]!.id);
    expect(next.assessments[1]!.id).not.toBe(original.assessments[0]!.id);
    expect(next.organizations[1]!.id).not.toBe(original.organizations[0]!.id);
    expect(new Set(again.assessments.map((a) => a.id)).size).toBe(3);
  });
  it('names the app in the format it writes, and still imports a backup written under the previous name', () => {
    const data = workspace();
    const bundle = diagnosticBundle(data, 'v2');
    expect(bundle.format).toBe(BUNDLE_FORMAT);
    expect(BUNDLE_FORMAT).toBe('a365-explorer');

    const older = { ...bundle, format: 'a365-capability-explorer' as const };
    expect(parseDiagnosticBundle(JSON.stringify(older))).toEqual({ ok: true, bundle: older });
    const merged = appendDiagnosticBundle(workspace(), older);
    expect(merged.assessments).toHaveLength(2);
    expect(merged.assessments[1]!.answers).toEqual(data.assessments[0]!.answers);
  });
  it.each(['{broken', '', '<html>not a backup</html>'])('rejects malformed JSON: %s', (raw) => {
    expect(parseDiagnosticBundle(raw)).toEqual({ ok: false, error: 'json' });
  });
  it('rejects unsupported versions, unknown fields, duplicate ids and missing relationships', () => {
    const bundle = diagnosticBundle(workspace(), 'v2');
    for (const invalid of [
      { ...bundle, formatVersion: 2 },
      { ...bundle, format: 'another-app' },
      { ...bundle, format: '' },
      { ...bundle, extra: true },
      { ...bundle, workspace: { ...bundle.workspace, organizations: [] } },
      {
        ...bundle,
        workspace: {
          ...bundle.workspace,
          assessments: [...bundle.workspace.assessments, ...bundle.workspace.assessments],
        },
      },
    ])
      expect(parseDiagnosticBundle(JSON.stringify(invalid))).toEqual({
        ok: false,
        error: 'format',
      });
  });
  it('enforces the byte limit, including multi-byte text', () => {
    expect(parseDiagnosticBundle(' '.repeat(MAX_IMPORT_BYTES + 1))).toEqual({
      ok: false,
      error: 'size',
    });
    expect(parseDiagnosticBundle('é'.repeat(MAX_IMPORT_BYTES / 2 + 1))).toEqual({
      ok: false,
      error: 'size',
    });
  });
});
