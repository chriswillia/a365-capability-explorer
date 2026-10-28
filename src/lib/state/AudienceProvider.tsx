import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  AUDIENCE_STORAGE_KEY,
  AudienceContext,
  DEFAULT_AUDIENCE,
  isAudience,
  type Audience,
} from './audience.ts';
import { readStored, writeStored } from './storage.ts';

function initialAudience(): Audience {
  const stored = readStored(AUDIENCE_STORAGE_KEY);
  return isAudience(stored) ? stored : DEFAULT_AUDIENCE;
}

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [audience, setAudienceState] = useState<Audience>(initialAudience);

  const setAudience = useCallback((next: Audience) => {
    setAudienceState(next);
    writeStored(AUDIENCE_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ audience, setAudience }), [audience, setAudience]);
  return <AudienceContext value={value}>{children}</AudienceContext>;
}
