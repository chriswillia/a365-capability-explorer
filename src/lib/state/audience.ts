import { createContext, useContext } from 'react';
import { AUDIENCES, type AudienceId } from '../content/constants.ts';

/** Who is selling: an AI seller, a Security seller, or both together. It changes emphasis and talk tracks, never facts. */
export type Audience = AudienceId;

/** The storage key for the chosen audience (see storage.ts for the prefix). */
export const AUDIENCE_STORAGE_KEY = 'audience';

/** Until a seller chooses, the neutral version that speaks to both. */
export const DEFAULT_AUDIENCE: Audience = 'joint';

export const isAudience = (value: string | null): value is Audience =>
  value !== null && (AUDIENCES as readonly string[]).includes(value);

export interface AudienceContextValue {
  audience: Audience;
  setAudience: (audience: Audience) => void;
}

export const AudienceContext = createContext<AudienceContextValue | null>(null);

export function useAudience(): AudienceContextValue {
  const value = useContext(AudienceContext);
  if (value === null) throw new Error('useAudience must be used inside <AudienceProvider>');
  return value;
}
