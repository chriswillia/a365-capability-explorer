import { createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';
import { colors, radii, typography } from './tokens.ts';

// Brand ramp anchored on the placeholder blue: 60 pressed, 70 hover and link, 80 the primary fill.
const brand: BrandVariants = {
  10: '#001322',
  20: '#001F38',
  30: '#002D50',
  40: '#003A66',
  50: '#004578',
  60: colors.bluePressed,
  70: colors.blueHover,
  80: colors.blue,
  90: '#2B88D8',
  100: '#4A9BE0',
  110: '#71AFE5',
  120: '#8FBFEA',
  130: '#ADD0EF',
  140: '#C7E0F4',
  150: '#DEECF9',
  160: colors.tint,
};

const lightTheme = createLightTheme(brand);

/** Fluent UI v9 theme fed by the same tokens as the CSS variables. Shadows are kept for overlays only. */
export const fluentTheme: Theme = {
  ...lightTheme,
  fontFamilyBase: typography.fontBody,
  fontFamilyNumeric: typography.fontBody,
  fontFamilyMonospace: typography.fontMono,
  colorNeutralForeground1: colors.ink,
  colorNeutralForeground2: colors.ink,
  colorNeutralForeground3: colors.slate,
  colorNeutralBackground1: colors.paper,
  colorNeutralStroke1: colors.controlBorder,
  colorNeutralStrokeAccessible: colors.controlBorder,
  colorNeutralStroke2: colors.hairline,
  colorBrandBackgroundPressed: colors.bluePressed,
  borderRadiusSmall: radii.sm,
  borderRadiusMedium: radii.md,
  borderRadiusLarge: radii.md,
  borderRadiusXLarge: radii.md,
  shadow2: 'none',
  shadow4: 'none',
  shadow8: 'none',
};
