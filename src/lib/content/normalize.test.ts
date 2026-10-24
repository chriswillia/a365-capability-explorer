import { describe, expect, it } from 'vitest';
import { normalizeSourceText } from './normalize.ts';

describe('normalizeSourceText', () => {
  it('turns curly quotes into straight ones', () => {
    expect(normalizeSourceText('that aren\u2019t managed')).toBe("that aren't managed");
    expect(normalizeSourceText('\u201Cquoted\u201D')).toBe('"quoted"');
  });

  it('turns non-breaking hyphens into plain hyphens', () => {
    expect(normalizeSourceText('Built\u2011in sponsor\u2011driven')).toBe(
      'Built-in sponsor-driven',
    );
  });

  it('removes zero-width characters', () => {
    expect(normalizeSourceText('Copilot Studio agents\u200B')).toBe('Copilot Studio agents');
  });

  it('collapses whitespace, including non-breaking spaces', () => {
    expect(normalizeSourceText('  a \u00A0  b\n c ')).toBe('a b c');
  });

  it('applies NFKC, for example to full-width characters', () => {
    expect(normalizeSourceText('\uFF21\uFF11')).toBe('A1');
  });

  it('keeps an en dash, which the service description uses on purpose', () => {
    expect(normalizeSourceText('agents \u2013 detect')).toBe('agents \u2013 detect');
  });
});
