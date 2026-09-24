import { I18nManager, type TextStyle } from 'react-native';

/** Visual-lock palette. See docs/ui-visual-spec.md §2. */
export const colors = {
  navy950: '#081628', navy900: '#0D213A', navy800: '#16304F', navy700: '#23405F',
  gold700: '#8E6A2B', gold600: '#A9803F', gold500: '#C9A45C', gold300: '#E4CD98', gold100: '#F6ECD6',
  canvas: '#F3EFE7', surface: '#FFFDF9', surfaceMuted: '#F8F4EC',
  ink: '#0F1E33', muted: '#6F7680', onDark: '#FFFFFF', onDarkMuted: '#B9C2CE', border: '#E9E2D5',
  success: '#2E7D4F', successSoft: '#E4F3E9', info: '#2F6FD6', infoSoft: '#E7EFFC',
  warning: '#A66A18', warningSoft: '#FBF0DC', danger: '#C23B36', dangerSoft: '#FBE7E6',
  neutral: '#8A9098', neutralSoft: '#EFEDE8', disabled: '#C9CDD2', white: '#FFFFFF',
} as const;

export const gradients = {
  hero: [colors.navy900, colors.navy950] as const,
  gold: ['#D9B872', colors.gold600] as const,
};

/** Font family names registered by the app with expo-font (see apps/mobile/app/_layout.tsx). */
export const fonts = { regular: 'NotoSansArabic_400Regular', medium: 'NotoSansArabic_500Medium', bold: 'NotoSansArabic_700Bold' } as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, input: 14, lg: 16, xl: 20, full: 999 } as const;
export const iconSize = { inline: 16, list: 20, tab: 24, hero: 28 } as const;
export const layout = { screenGutter: 16, sectionGap: 12, heroOverlap: 40, maxContentWidth: 680, minTouchTarget: 48, tabBarHeight: 64 } as const;

export const elevation = {
  card: { shadowColor: colors.navy950, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  raised: { shadowColor: colors.navy950, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
} as const;

/**
 * Right-to-left helpers. React Native mirrors `row` and swaps `left`/`right` text alignment when the
 * native layout is RTL (Android and iOS), but not on the first launch after `forceRTL`, in some Expo Go
 * sessions, or on web. Resolving against `I18nManager.isRTL` keeps the Arabic visual order identical in
 * every case.
 */
const nativeRTL = I18nManager.isRTL;
export const rtl = {
  row: (nativeRTL ? 'row' : 'row-reverse') as 'row' | 'row-reverse',
  text: { textAlign: nativeRTL ? 'left' : 'right', writingDirection: 'rtl' } as TextStyle,
  /** Icon fonts never mirror, so "forward" in Arabic (towards the left) is always the back-pointing glyph. */
  forwardIcon: 'chevron-back',
  backIcon: 'chevron-forward',
  /** Absolute-position key for the visual left edge regardless of native swapping. */
  visualLeft: (nativeRTL ? 'right' : 'left') as 'left' | 'right',
} as const;

const text = (fontFamily: string, fontSize: number, lineHeight: number, color: string = colors.ink): TextStyle => ({ fontFamily, fontSize, lineHeight, color, ...rtl.text });
export const type = {
  display: text(fonts.bold, 27, 42, colors.onDark),
  title: text(fonts.bold, 22, 34),
  section: text(fonts.bold, 17, 28),
  bodyStrong: text(fonts.medium, 15, 24),
  body: text(fonts.regular, 14, 23),
  label: text(fonts.regular, 13, 21, colors.muted),
  caption: text(fonts.medium, 12, 19, colors.muted),
  metric: text(fonts.bold, 28, 38),
} as const;

export type Tone = 'neutral' | 'gold' | 'success' | 'info' | 'warning' | 'danger';
export const tones: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.neutral, bg: colors.neutralSoft },
  gold: { fg: colors.gold700, bg: colors.gold100 },
  success: { fg: colors.success, bg: colors.successSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
};
