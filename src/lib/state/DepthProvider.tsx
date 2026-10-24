import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DEPTH_STORAGE_KEY, DepthContext, type Depth } from './depth.ts';
import { readStored, writeStored } from './storage.ts';

function initialDepth(): Depth {
  return readStored(DEPTH_STORAGE_KEY) === 'technical' ? 'technical' : 'executive';
}

export function DepthProvider({ children }: { children: ReactNode }) {
  const [depth, setDepthState] = useState<Depth>(initialDepth);

  const setDepth = useCallback((next: Depth) => {
    setDepthState(next);
    writeStored(DEPTH_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ depth, setDepth }), [depth, setDepth]);
  return <DepthContext value={value}>{children}</DepthContext>;
}
