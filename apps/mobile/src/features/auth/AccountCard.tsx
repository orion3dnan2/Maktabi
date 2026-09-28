import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@maktabi/ui';
import { LuxeCard, rtl, SectionTitle } from '@/components/luxe';
import { useAuth } from '@/auth/AuthProvider';
import { roleLabels } from '@/auth/access';

/** Who is signed in, plus sign-out. Shown on the more tab, portal and platform console. */
export function AccountCard() {
  const { access, signOut } = useAuth();
  if (!access) return null;
  const role = access.platform_admin && !access.office ? 'مالك المنصة' : access.role ? roleLabels[access.role] : '';
  return <LuxeCard>
    <SectionTitle icon="person-circle-outline" title="حسابي"/>
    <Text style={styles.name}>{access.full_name || '—'}</Text>
    <Text style={styles.meta}>{[role, access.office?.name].filter(Boolean).join(' · ')}</Text>
    {access.phone ? <Text style={[styles.meta, { writingDirection: 'ltr' }]}>{access.phone}</Text> : null}
    <View style={styles.divider}/>
    <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]}><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable>
  </LuxeCard>;
}
const styles = StyleSheet.create({
  name: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 18 },
  meta: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 14, lineHeight: 22 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  logout: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  logoutText: { color: colors.danger, fontFamily: typography.bold, fontSize: 16 },
});
