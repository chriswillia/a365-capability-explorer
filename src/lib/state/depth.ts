import { createContext, useContext } from 'react';

/** The global Executive | Technical view. Executive shows outcomes; Technical adds consoles, notes and evidence. */
export type Depth = 'executive' | 'technical';

/** The storage key for the chosen depth (see storage.ts for the prefix). */
export const DEPTH_STORAGE_KEY = 'depth';

export interface DepthContextValue {
  depth: Depth;
  setDepth: (depth: Depth) => void;
}

export const DepthContext = createContext<DepthContextValue | null>(null);

export function useDepth(): DepthContextValue {
  const value = useContext(DepthContext);
  if (value === null) throw new Error('useDepth must be used inside <DepthProvider>');
  return value;
}
