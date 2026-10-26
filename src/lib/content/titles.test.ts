import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import { overviewTitle, pageTitle } from './titles.ts';

describe('titles', () => {
  it('builds the home title from the product name and subtitle, dropping the closing full stop', () => {
    expect(
      overviewTitle({
        productName: 'A365 Capability Explorer',
        tagline: 'Map any agent use case to Microsoft Agent 365.',
      }),
    ).toBe('A365 Capability Explorer: Map any agent use case to Microsoft Agent 365');
  });

  it('keeps other punctuation in the subtitle', () => {
    expect(overviewTitle({ productName: 'X', tagline: 'Plan, map and present?' })).toBe(
      'X: Plan, map and present?',
    );
  });

  it('puts the page name first on every other page', () => {
    expect(pageTitle({ productName: 'A365 Capability Explorer' }, 'Capabilities')).toBe(
      'Capabilities · A365 Capability Explorer',
    );
  });

  it('is named and subtitled as the project owner specified', () => {
    expect(content.site.productName).toBe('A365 Capability Explorer');
    expect(content.site.tagline).toBe('Map any agent use case to Microsoft Agent 365.');
  });
});
