import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import { overviewTitle, pageTitle } from './titles.ts';

describe('titles', () => {
  it('builds the home title from the product name and subtitle, dropping the closing full stop', () => {
    expect(
      overviewTitle({
        productName: 'Control Plane Compass',
        tagline: 'Map any agent use case to Microsoft Agent 365.',
      }),
    ).toBe('Control Plane Compass: Map any agent use case to Microsoft Agent 365');
  });

  it('keeps other punctuation in the subtitle', () => {
    expect(overviewTitle({ productName: 'X', tagline: 'Plan, map and present?' })).toBe(
      'X: Plan, map and present?',
    );
  });

  it('puts the page name first on every other page', () => {
    expect(pageTitle({ productName: 'Control Plane Compass' }, 'Capabilities')).toBe(
      'Capabilities · Control Plane Compass',
    );
  });

  it('is named and subtitled as the project owner specified', () => {
    expect(content.site.productName).toBe('Control Plane Compass');
    expect(content.site.tagline).toBe('Map any agent use case to Microsoft Agent 365.');
  });
});
