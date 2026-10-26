import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticWorkspaceSchema, emptyWorkspace } from './diagnostic-model.ts';
import {
  DIAGNOSTIC_STORAGE_KEY,
  loadDiagnostics,
  resetDiagnostics,
  saveDiagnostics,
} from './diagnostic-storage.ts';
import { STORAGE_PREFIX, tryReadStored, tryRemoveStored, tryWriteStored } from './storage.ts';

const key = STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY;
let values: Map<string, string>;
let storage: {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  values = new Map();
  storage = {
    getItem: vi.fn((k: string) => values.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      values.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      values.delete(k);
    }),
  };
  vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());
const workspace = () => {
  const data = emptyWorkspace();
  const now = '2026-10-26T12:00:00.000Z';
  const org = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    contentVersion: 'v1',
    answers: { orgName: 'Fictional org', cloudEnvironment: 'gcc' },
  };
  data.organizations.push(org);
  data.assessments.push({
    id: crypto.randomUUID(),
    organizationId: org.id,
    createdAt: now,
    updatedAt: now,
    contentVersion: 'v1',
    answers: { useCaseName: 'Local test', tools: ['none'] },
    mode: 'quick',
    sectionId: 'build',
    patternId: null,
    sampleId: null,
  });
  return data;
};

describe('local diagnostic persistence', () => {
  it('loads an empty workspace without writing anything, then saves and resumes every field', () => {
    const initial = loadDiagnostics();
    expect(initial.error).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    const data = workspace();
    const saved = saveDiagnostics(initial, data);
    expect(saved.dirty).toBe(false);
    expect(saved.error).toBeNull();
    expect(loadDiagnostics().data).toEqual(data);
    expect(values.get(key)).toBe(JSON.stringify(data));
  });
  it.each(['{bad-json', '{"schemaVersion":2}', 'null', '[]'])(
    'preserves unreadable or unsupported data: %s',
    (raw) => {
      values.set(key, raw);
      const state = loadDiagnostics();
      expect(state.error).toBe('invalid');
      expect(state.recoveryRaw).toBe(raw);
      expect(() => saveDiagnostics(state, emptyWorkspace())).toThrow(/explicit reset/);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(values.get(key)).toBe(raw);
    },
  );
  it('preserves invalid recovery data when reset fails, and never unlocks writes', () => {
    values.set(key, '{broken');
    const state = loadDiagnostics();
    storage.removeItem.mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const failed = resetDiagnostics(state);
    expect(failed.error).toBe('unavailable');
    expect(failed.recoveryRaw).toBe('{broken');
    expect(() => saveDiagnostics(failed, emptyWorkspace())).toThrow(/explicit reset/);
    expect(values.get(key)).toBe('{broken');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('resets only the diagnostic key after explicit confirmation', () => {
    values.set(key, '{broken');
    values.set(STORAGE_PREFIX + 'depth', 'technical');
    expect(resetDiagnostics(loadDiagnostics()).recoveryRaw).toBeNull();
    expect(values.has(key)).toBe(false);
    expect(values.get(STORAGE_PREFIX + 'depth')).toBe('technical');
  });
  it('keeps a quota-failed draft in memory and allows a successful retry', () => {
    const initial = loadDiagnostics();
    const data = workspace();
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const failed = saveDiagnostics(initial, data);
    expect(failed).toMatchObject({ data, error: 'quota', dirty: true, savedRaw: null });
    expect(values.has(key)).toBe(false);
    expect(saveDiagnostics(failed, failed.data)).toMatchObject({ data, error: null, dirty: false });
  });
  it('surfaces unavailable storage without discarding edits', () => {
    storage.getItem.mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const initial = loadDiagnostics();
    expect(initial.error).toBe('unavailable');
    const data = workspace();
    expect(saveDiagnostics(initial, data)).toMatchObject({
      data,
      error: 'unavailable',
      dirty: true,
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('does not overwrite another tab, including when that tab deletes the workspace', () => {
    const a = loadDiagnostics();
    const b = loadDiagnostics();
    const first = workspace();
    expect(saveDiagnostics(a, first).dirty).toBe(false);
    const second = workspace();
    expect(saveDiagnostics(b, second)).toMatchObject({
      data: second,
      error: 'conflict',
      dirty: true,
    });
    expect(JSON.parse(values.get(key)!)).toEqual(first);
    const loaded = loadDiagnostics();
    values.delete(key);
    expect(saveDiagnostics(loaded, first)).toMatchObject({ error: 'conflict', dirty: true });
    expect(values.has(key)).toBe(false);
  });
  it('retains stale answers for explicit current-content recovery, rather than silently rewriting them', () => {
    const data = workspace();
    data.assessments[0]!.answers.retiredQuestion = 'old-answer';
    values.set(key, JSON.stringify(data));
    expect(loadDiagnostics()).toMatchObject({ data, error: null });
  });
});

describe('persisted workspace schema', () => {
  it('rejects duplicate identifiers and dangling organization references', () => {
    const data = workspace();
    expect(DiagnosticWorkspaceSchema.safeParse(data).success).toBe(true);
    data.organizations.push(data.organizations[0]!);
    expect(DiagnosticWorkspaceSchema.safeParse(data).success).toBe(false);
    data.organizations.pop();
    data.assessments.push(data.assessments[0]!);
    expect(DiagnosticWorkspaceSchema.safeParse(data).success).toBe(false);
    data.assessments.pop();
    data.assessments[0]!.organizationId = crypto.randomUUID();
    expect(DiagnosticWorkspaceSchema.safeParse(data).success).toBe(false);
  });
  it('rejects invalid ids, timestamps and unsupported versions', () => {
    const data = workspace();
    for (const patch of [
      { id: 'not-a-uuid' },
      { createdAt: 'yesterday' },
      { contentVersion: '' },
    ]) {
      expect(
        DiagnosticWorkspaceSchema.safeParse({
          ...data,
          organizations: [{ ...data.organizations[0], ...patch }],
        }).success,
      ).toBe(false);
    }
    expect(DiagnosticWorkspaceSchema.safeParse({ ...data, schemaVersion: 2 }).success).toBe(false);
  });
});

describe('storage result APIs', () => {
  it('reports access failures for read, write and remove without claiming success', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(tryReadStored('diagnostic')).toEqual({ ok: false, error: 'unavailable' });
    expect(tryWriteStored('diagnostic', 'value')).toEqual({ ok: false, error: 'unavailable' });
    expect(tryRemoveStored('diagnostic')).toEqual({ ok: false, error: 'unavailable' });
  });
});
