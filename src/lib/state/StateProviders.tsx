import type { ReactNode } from 'react';
import { AudienceProvider } from './AudienceProvider.tsx';
import { DepthProvider } from './DepthProvider.tsx';

/** The reading depth and the audience lens: the two choices the header offers and many pages follow. */
export function StateProviders({ children }: { children: ReactNode }) {
  return (
    <DepthProvider>
      <AudienceProvider>{children}</AudienceProvider>
    </DepthProvider>
  );
}
