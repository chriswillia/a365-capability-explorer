import {
  DiagnosticWorkspaceSchema,
  emptyWorkspace,
  type DiagnosticWorkspace,
} from './diagnostic-model.ts';
import { tryReadStored, tryRemoveStored, tryWriteStored, type StorageFailure } from './storage.ts';

export const DIAGNOSTIC_STORAGE_KEY = 'diagnostic';
export type DiagnosticFailure = StorageFailure | 'invalid' | 'conflict';
export interface DiagnosticState {
  data: DiagnosticWorkspace;
  savedRaw: string | null;
  recoveryRaw: string | null;
  error: DiagnosticFailure | null;
  dirty: boolean;
}

export function loadDiagnostics(): DiagnosticState {
  const result = tryReadStored(DIAGNOSTIC_STORAGE_KEY);
  const blank = { data: emptyWorkspace(), savedRaw: null, recoveryRaw: null, dirty: false };
  if (!result.ok) return { ...blank, error: result.error };
  if (result.value === null) return { ...blank, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.value);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ...blank, savedRaw: result.value, recoveryRaw: result.value, error: 'invalid' };
  }
  const data = DiagnosticWorkspaceSchema.safeParse(parsed);
  return data.success
    ? { data: data.data, savedRaw: result.value, recoveryRaw: null, error: null, dirty: false }
    : { ...blank, savedRaw: result.value, recoveryRaw: result.value, error: 'invalid' };
}

export function saveDiagnostics(
  state: DiagnosticState,
  data: DiagnosticWorkspace,
): DiagnosticState {
  if (state.recoveryRaw !== null)
    throw new Error('Cannot overwrite invalid diagnostic storage without an explicit reset');
  DiagnosticWorkspaceSchema.parse(data);
  const previous = tryReadStored(DIAGNOSTIC_STORAGE_KEY);
  if (!previous.ok) return { ...state, data, error: previous.error, dirty: true };
  if (previous.value !== state.savedRaw) return { ...state, data, error: 'conflict', dirty: true };
  const raw = JSON.stringify(data);
  const result = tryWriteStored(DIAGNOSTIC_STORAGE_KEY, raw);
  return result.ok
    ? { data, savedRaw: raw, recoveryRaw: null, error: null, dirty: false }
    : { ...state, data, error: result.error, dirty: true };
}

export function resetDiagnostics(state: DiagnosticState): DiagnosticState {
  const result = tryRemoveStored(DIAGNOSTIC_STORAGE_KEY);
  if (!result.ok) return { ...state, error: result.error };
  return loadDiagnostics();
}
