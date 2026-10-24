import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast.ts';
import { colors, cssVariables, heat } from './tokens.ts';

/*
 * WCAG 2.2 AA, encoded. Text needs 4.5:1; borders of controls, focus rings and other non-text UI need 3:1.
 * The brief's interactive blue (#0078D4) is 4.27:1 on the paper canvas, so link text uses colors.link instead.
 */
const textPairs: [string, string, string][] = [
  ['ink on paper', colors.ink, colors.paper],
  ['ink on white', colors.ink, colors.white],
  ['slate on paper', colors.slate, colors.paper],
  ['slate on white', colors.slate, colors.white],
  ['link on paper', colors.link, colors.paper],
  ['link on white', colors.link, colors.white],
  ['link on tint', colors.link, colors.tint],
  ['link hover on paper', colors.linkHover, colors.paper],
  ['white on blue (buttons)', colors.white, colors.blue],
  ['white on blue hover', colors.white, colors.blueHover],
  ['white on blue pressed', colors.white, colors.bluePressed],
  ['white on gradient start', colors.onDark, colors.frontierFrom],
  ['white on gradient end', colors.onDark, colors.frontierTo],
  ['white on ink (banner)', colors.onDark, colors.ink],
  ['amber text on amber background', colors.amberText, colors.amberBackground],
];

const nonTextPairs: [string, string, string][] = [
  ['control border on paper', colors.controlBorder, colors.paper],
  ['control border on white', colors.controlBorder, colors.white],
  ['focus ring on paper', colors.focusRing, colors.paper],
  ['focus ring on white', colors.focusRing, colors.white],
  ['focus ring on dark, over the gradient start', colors.focusRingOnDark, colors.frontierFrom],
  ['focus ring on dark, over the gradient end', colors.focusRingOnDark, colors.frontierTo],
  ['active nav underline on white', colors.blue, colors.white],
];

describe('design tokens meet WCAG 2.2 AA contrast', () => {
  it.each(textPairs)('%s is at least 4.5:1', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(nonTextPairs)('%s is at least 3:1', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it('documents why the placeholder blue is not used for link text on paper', () => {
    expect(contrastRatio(colors.blue, colors.paper)).toBeLessThan(4.5);
  });
});

describe('contrast helpers', () => {
  it('computes known values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('rejects colors that are not six-digit hex', () => {
    expect(() => relativeLuminance('#FFF')).toThrow();
  });
});

describe('heatmap ramp', () => {
  it('gets darker at every step', () => {
    const luminance = heat.map((hex) => relativeLuminance(hex));
    for (let i = 1; i < luminance.length; i += 1) {
      expect(luminance[i]).toBeLessThan(luminance[i - 1] as number);
    }
  });
});

describe('cssVariables', () => {
  const css = cssVariables();

  it('emits one :root block', () => {
    expect(css.startsWith(':root{')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
  });

  it('defines every variable the stylesheets rely on', () => {
    for (const name of [
      '--color-ink',
      '--color-slate',
      '--color-paper',
      '--color-white',
      '--color-hairline',
      '--color-link',
      '--color-link-hover',
      '--color-blue',
      '--color-blue-hover',
      '--color-blue-pressed',
      '--color-control-border',
      '--color-focus-ring',
      '--color-focus-ring-on-dark',
      '--color-on-dark',
      '--color-amber-text',
      '--color-amber-background',
      '--color-tint',
      '--color-horizon-line',
      '--gradient-frontier',
      '--font-display',
      '--font-body',
      '--text-12',
      '--text-56',
      '--space-4',
      '--radius-md',
      '--layout-max-width',
      '--motion-fast',
    ]) {
      expect(css, name).toContain(`${name}:`);
    }
  });

  it('defines no variable twice', () => {
    const names = [...css.matchAll(/--[a-z0-9-]+(?=:)/g)].map((m) => m[0]);
    expect(new Set(names).size).toBe(names.length);
  });
});
