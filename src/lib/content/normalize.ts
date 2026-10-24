/*
 * Normalization applied before comparing text from the Microsoft service description with our copy:
 * NFKC, zero-width characters, curly quotes, hyphen variants (including the non-breaking hyphen) and whitespace.
 * Shared by the tests now and by the weekly source watch (scripts/check-source.ts) later.
 */
export function normalizeSourceText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2012\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
