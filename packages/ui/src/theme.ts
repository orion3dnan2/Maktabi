import { Platform } from 'react-native';
export const colors = {
  navy950: '#071C33', navy900: '#0B2949', navy800: '#123B63', gold600: '#9B7937', gold500: '#B99A53', gold100: '#F5EEDA',
  ink: '#172331', muted: '#687482', canvas: '#F7F6F2', surface: '#FFFFFF', border: '#E4E1D8', success: '#287452', danger: '#A74242', warning: '#A66A18', white: '#FFFFFF',
} as const;
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;
export const typography = { regular: Platform.select({ ios: 'System', android: 'sans-serif' }), medium: Platform.select({ ios: 'System', android: 'sans-serif-medium' }), bold: Platform.select({ ios: 'System', android: 'sans-serif' }) } as const;
export const elevation = { card: { shadowColor: colors.navy950, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 } } as const;
export const layout = { screenGutter: 16, maxContentWidth: 680, minTouchTarget: 48 } as const;
export const statusColors = { active: colors.success, urgent: colors.danger, pending: colors.gold600, closed: colors.muted } as const;
