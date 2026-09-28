import { type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, typography } from '@maktabi/ui';
import { Emblem, HeroBackdrop, row, rtl, type IonName } from '@/components/luxe';

/** Brand hero + cream card used by the sign-in and owner-setup screens. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <HeroBackdrop style={StyleSheet.absoluteFill} scales={false}/>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <View style={styles.emblemGlow}><Emblem size={96}/></View>
        <Text style={styles.brandName}>مكتب المحامي</Text>
        <Text style={styles.brandSub}>للاستشارات القانونية والمحاماة</Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function AuthField({ icon, error, end, ...input }: TextInputProps & { icon: IonName; error?: boolean; end?: ReactNode }) {
  return <View style={[styles.field, { flexDirection: row }, error && styles.fieldError]}>
    <Ionicons name={icon} size={26} color={colors.navy900}/>
    <TextInput placeholderTextColor={colors.muted} {...input} style={[styles.input, input.style]}/>
    {end}
  </View>;
}

export const authStyles = StyleSheet.create({
  error: { ...rtl, color: colors.danger, fontFamily: typography.medium, fontSize: 14, lineHeight: 22 },
  note: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 22 },
  link: { color: colors.gold700, fontFamily: typography.bold, fontSize: 15, textAlign: 'center' },
  options: { justifyContent: 'space-between', alignItems: 'center' },
  remember: { minHeight: 44, alignItems: 'center', gap: 10 },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.gold600, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.gold500 },
  optionText: { color: colors.navy950, fontFamily: typography.medium, fontSize: 16 },
  secure: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondary: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerBg, paddingHorizontal: 12 },
  secondaryText: { color: colors.danger, fontFamily: typography.bold, fontSize: 15, textAlign: 'center' },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.navy950 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, justifyContent: 'center', gap: 28 },
  brand: { alignItems: 'center', gap: 6 },
  emblemGlow: { borderRadius: 80, padding: 6, backgroundColor: 'rgba(200,162,90,0.10)', marginBottom: 8 },
  brandName: { color: '#F8E9C8', fontFamily: typography.black, fontSize: 36, lineHeight: 50, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  brandSub: { color: '#E6E9EF', fontFamily: typography.medium, fontSize: 17 },
  card: { borderRadius: 28, padding: 24, gap: 16, backgroundColor: colors.cream, borderWidth: 1, borderColor: '#FFFFFF', ...elevation.raised },
  title: { textAlign: 'center', color: colors.navy950, fontFamily: typography.black, fontSize: 30, lineHeight: 42 },
  subtitle: { textAlign: 'center', writingDirection: 'rtl', color: '#5B6372', fontFamily: typography.regular, fontSize: 15, lineHeight: 26 },
  field: { minHeight: 64, borderRadius: 16, alignItems: 'center', gap: 12, paddingHorizontal: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card, shadowOpacity: 0.05 },
  fieldError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 56, ...rtl, color: colors.ink, fontFamily: typography.medium, fontSize: 16, outlineStyle: 'none' } as never,
});
