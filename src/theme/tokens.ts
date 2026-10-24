/*
 * Frontier Executive design tokens. Every brand decision lives here. The same values feed the CSS variables
 * (cssVariables, injected into index.html at build time) and the Fluent UI v9 theme (fluentTheme.ts).
 * These are placeholder tokens until brand-approved values arrive. Components use var(--token), never raw values.
 */

export const colors = {
  ink: '#0A1A2F',
  slate: '#5A6B82',
  paper: '#FAF8F4',
  white: '#FFFFFF',
  hairline: '#E4DFD6',
  blue: '#0078D4',
  blueHover: '#106EBE',
  bluePressed: '#005A9E',
  // Link text on the paper canvas. The brief's #0078D4 is 4.27:1 on paper, below WCAG AA (4.5:1).
  link: '#106EBE',
  linkHover: '#005A9E',
  // Borders of form controls need 3:1 (WCAG 1.4.11). The hairline is decorative only.
  controlBorder: '#7C8AA0',
  focusRing: '#0078D4',
  focusRingOnDark: '#FFFFFF',
  frontierFrom: '#0078D4',
  frontierTo: '#7B5CD6',
  amberText: '#8A5300',
  amberBackground: '#FFF4DE',
  tint: '#EFF6FC',
  onDark: '#FFFFFF',
  horizonLine: 'rgb(255 255 255 / 0.38)',
  scrim: 'rgb(10 26 47 / 0.5)',
} as const;

// Single-hue blue ramp for heatmaps, lightest to darkest.
export const heat = ['#EFF6FC', '#C7E0F4', '#71AFE5', '#2B88D8', '#0078D4', '#005A9E'] as const;

export const gradients = {
  frontier: `linear-gradient(100deg, ${colors.frontierFrom} 0%, ${colors.frontierTo} 100%)`,
} as const;

export const typography = {
  fontDisplay: '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
  fontBody:
    '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  fontMono: '"Cascadia Mono", Consolas, "SF Mono", Menlo, monospace',
  // Type scale 12/14/16/20/24/32/44/56 px, in rem so it follows the reader's browser settings.
  size: {
    12: '0.75rem',
    14: '0.875rem',
    16: '1rem',
    20: '1.25rem',
    24: '1.5rem',
    32: '2rem',
    44: '2.75rem',
    56: '3.5rem',
  },
  lineHeight: { tight: '1.12', snug: '1.3', body: '1.55' },
} as const;

// 8-point spacing scale with a 4px half step.
export const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

export const radii = { sm: '2px', md: '4px' } as const;
// Shadows appear on overlays only.
export const shadows = { overlay: '0 8px 24px rgb(10 26 47 / 0.18)' } as const;
export const layout = { maxWidth: '1240px', gutter: '24px', gutterNarrow: '16px' } as const;
export const motion = {
  fast: '150ms',
  base: '200ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The :root block of CSS custom properties. */
export function cssVariables(): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(colors)) lines.push(`--color-${kebab(name)}:${value}`);
  heat.forEach((value, index) => lines.push(`--heat-${index + 1}:${value}`));
  lines.push(`--gradient-frontier:${gradients.frontier}`);
  lines.push(`--font-display:${typography.fontDisplay}`);
  lines.push(`--font-body:${typography.fontBody}`);
  lines.push(`--font-mono:${typography.fontMono}`);
  for (const [key, value] of Object.entries(typography.size)) lines.push(`--text-${key}:${value}`);
  for (const [key, value] of Object.entries(typography.lineHeight)) {
    lines.push(`--line-height-${key}:${value}`);
  }
  for (const [key, value] of Object.entries(space)) lines.push(`--space-${key}:${value}`);
  for (const [key, value] of Object.entries(radii)) lines.push(`--radius-${key}:${value}`);
  lines.push(`--shadow-overlay:${shadows.overlay}`);
  lines.push(`--layout-max-width:${layout.maxWidth}`);
  lines.push(`--layout-gutter:${layout.gutter}`);
  lines.push(`--layout-gutter-narrow:${layout.gutterNarrow}`);
  lines.push(`--motion-fast:${motion.fast}`);
  lines.push(`--motion-base:${motion.base}`);
  lines.push(`--motion-easing:${motion.easing}`);
  return `:root{${lines.join(';')}}`;
}
