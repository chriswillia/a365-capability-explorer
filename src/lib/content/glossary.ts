import type { GlossaryEntry } from './schemas.ts';

export type GlossarySegment = string | { text: string; entry: GlossaryEntry };

/** A fresh instance per page render keeps first-use detection deterministic and free of persistent state. */
export function createGlossaryMatcher(entries: GlossaryEntry[]) {
  const seen = new Set<string>();
  const terms = entries
    .flatMap((entry) => [entry.term, ...entry.aliases].map((term) => ({ term, entry })))
    .sort((a, b) => b.term.length - a.term.length);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression =
    terms.length === 0
      ? null
      : new RegExp(
          `(?<![\\p{L}\\p{N}_])(?:${terms.map(({ term }) => escape(term)).join('|')})(?![\\p{L}\\p{N}_])`,
          'giu',
        );
  const byText = new Map(terms.map(({ term, entry }) => [term.toLocaleLowerCase(), entry]));
  return (text: string): GlossarySegment[] => {
    if (!expression) return [text];
    const result: GlossarySegment[] = [];
    let end = 0;
    for (const match of text.matchAll(expression)) {
      const entry = byText.get(match[0].toLocaleLowerCase());
      if (!entry || seen.has(entry.id)) continue;
      result.push(text.slice(end, match.index), { text: match[0], entry });
      seen.add(entry.id);
      end = match.index + match[0].length;
    }
    result.push(text.slice(end));
    return result;
  };
}
