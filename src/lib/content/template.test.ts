import { describe, expect, it } from 'vitest';
import { formatNumber, renderTemplate, templateKeys } from './template.ts';

describe('templateKeys', () => {
  it('lists each placeholder once, in order of first appearance', () => {
    expect(templateKeys('{a} of {b}, then {a} again')).toEqual(['a', 'b']);
  });

  it('ignores braces that are not placeholders', () => {
    expect(templateKeys('plain { text } and {1bad}')).toEqual([]);
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
});

describe('formatNumber', () => {
  it('uses thousands separators', () => {
    expect(formatNumber(26)).toBe('26');
    expect(formatNumber(12000)).toBe('12,000');
  });
});
