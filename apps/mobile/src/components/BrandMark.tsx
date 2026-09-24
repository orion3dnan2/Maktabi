import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@maktabi/ui';

/** Temporary brand mark. Replace only when the approved production artwork is supplied. */
export function BrandMark({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  const color = inverse ? colors.white : colors.navy900;
  return <View accessibilityLabel="مكتبي" style={[styles.wrap, compact && styles.compact]}>
    <Ionicons name="scale-outline" size={compact ? 30 : 58} color={colors.gold500}/>
    {!compact ? <><Text style={[styles.arabic, { color }]}>مكتبي</Text><Text style={[styles.latin, { color }]}>MAKTABI</Text><Text style={styles.temporary}>هوية مؤقتة</Text></> : null}
  </View>;
}
const styles = StyleSheet.create({ wrap: { alignItems: 'center', gap: spacing.xxs }, compact: { flexDirection: 'row-reverse' }, arabic: { fontFamily: typography.medium, fontSize: 31, lineHeight: 42 }, latin: { fontSize: 11, letterSpacing: 3 }, temporary: { color: colors.muted, fontSize: 9 } });
