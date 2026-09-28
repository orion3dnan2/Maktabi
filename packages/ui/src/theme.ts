export const colors = {
  navy950: '#061B2D', navy900: '#08243A', navy800: '#0B304A', navy700: '#21465C', gold700: '#805719', gold600: '#A57829', gold500: '#D7A947', gold400: '#F3D994', gold100: '#F8EDD3', gold50: '#FCF5E6',
  ink: '#071A2C', muted: '#7B7F88', canvas: '#F4EFE5', surface: '#FFFDF8', cream: '#FAF7F0', border: '#EEE9E0', success: '#1A9B63', successBg: '#E3F4EA', danger: '#E84C4C', dangerBg: '#FCE7E7', warning: '#D99A25', warningBg: '#FBF1DD', info: '#2F80ED', infoBg: '#E6EEFC', white: '#FFFFFF',
} as const;
export const gradients = {
  navy: ['#214156', '#08243A', '#061B2D'] as const,
  gold: ['#F3D994', '#D7A947', '#956B26'] as const,
  goldSoft: ['#F8EFDB', '#F1E3C2'] as const,
  green: ['#2FA870', '#1C7D51'] as const,
  card: ['#FFFFFF', '#FFFDF8', '#FAF7F0'] as const,
};
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, full: 999 } as const;
export const typography = { regular: 'Tajawal_400Regular', medium: 'Tajawal_500Medium', bold: 'Tajawal_700Bold', black: 'Tajawal_800ExtraBold' } as const;
export const elevation = {
  card: { shadowColor: '#0C2140', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 6 },
  raised: { shadowColor: '#081629', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 10 },
  gold: { shadowColor: '#9E7733', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10 },
} as const;
export const layout = { screenGutter: 16, maxContentWidth: 680, minTouchTarget: 48 } as const;
export const statusColors = { active: colors.success, urgent: colors.danger, pending: colors.gold600, closed: colors.muted } as const;
