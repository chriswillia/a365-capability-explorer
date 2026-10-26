import type { ReactNode } from 'react';
import { GlossaryTerm } from '../../components/GlossaryTerm.tsx';
import { content } from './index.ts';
import { createGlossaryMatcher } from './glossary.ts';

export function createGlossaryAnnotator() {
  const match = createGlossaryMatcher(content.glossary);
  return (text: string): ReactNode =>
    match(text).map((segment, index) =>
      typeof segment === 'string' ? (
        segment
      ) : (
        <GlossaryTerm key={`${segment.entry.id}-${index}`} {...segment} />
      ),
    );
}
