import { describe, expect, it } from 'vitest';
import { formatNumber, renderTemplate, templateKeys } from './template.ts';

describe('templateKeys', () => {
  it('lists each placeholder once, in order of first appearance', () => {
    expect(templateKeys('{a} of {b}, then {a} again')).toEqual(['a', 'b']);
  });

  it('ignores braces that are not placeholders', () => {
    expect(templateKeys('plain { text } and {1bad}')).toEqual([]);
  });

  it('names the number behind a plural placeholder', () => {
    expect(templateKeys('{count} {count?item|items} for {label}')).toEqual(['count', 'label']);
  });
});

describe('renderTemplate', () => {
  it('fills placeholders and formats numbers for display', () => {
    expect(renderTemplate('{count} capabilities, {label}', { count: 1234, label: 'Observe' })).toBe(
      '1,234 capabilities, Observe',
    );
  });

  it('throws when a placeholder has no value, so a typo cannot ship', () => {
    expect(() => renderTemplate('{missing}', {})).toThrow(/\{missing\}/);
  });

  it('leaves text without placeholders unchanged', () => {
    expect(renderTemplate('Nothing to fill.', {})).toBe('Nothing to fill.');
  });

  it.each([
    [0, '0 are not available in GCC'],
    [1, '1 is not available in GCC'],
    [2, '2 are not available in GCC'],
    [1000, '1,000 are not available in GCC'],
  ])('agrees the verb with %i', (count, expected) => {
    expect(renderTemplate('{count} {count?is|are} not available in GCC', { count })).toBe(expected);
  });

  it('chooses a noun and a verb from the same number', () => {
    const template = '{n} {n?capability is|capabilities are} in scope';
    expect(renderTemplate(template, { n: 1 })).toBe('1 capability is in scope');
    expect(renderTemplate(template, { n: 12 })).toBe('12 capabilities are in scope');
  });

  it('can use the same number for several plural words', () => {
    expect(renderTemplate('{n?This|These} {n?answer needs|answers need} a source', { n: 1 })).toBe(
      'This answer needs a source',
    );
  });

  it('throws when a plural placeholder is given text instead of a number', () => {
    expect(() => renderTemplate('{label?a|b}', { label: 'x' })).toThrow(/needs a number/);
  });

  it('throws when the number behind a plural placeholder is missing', () => {
    expect(() => renderTemplate('{count?a|b}', {})).toThrow(/\{count\}/);
  });
});

describe('formatNumber', () => {
  it('uses thousands separators', () => {
    expect(formatNumber(26)).toBe('26');
    expect(formatNumber(12000)).toBe('12,000');
  });
});
