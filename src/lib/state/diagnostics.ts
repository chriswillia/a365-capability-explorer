import { createContext, useContext } from 'react';
import type { DiagnosticWorkspace } from './diagnostic-model.ts';
import type { DiagnosticState } from './diagnostic-storage.ts';

export interface DiagnosticContextValue extends DiagnosticState {
  change: (edit: (draft: DiagnosticWorkspace) => void) => void;
  retry: () => void;
  reload: () => void;
  reset: () => void;
}
export const DiagnosticContext = createContext<DiagnosticContextValue | null>(null);
export function useDiagnostics() {
  const value = useContext(DiagnosticContext);
  if (!value) throw new Error('Diagnostic state requires its route provider');
  return value;
}
