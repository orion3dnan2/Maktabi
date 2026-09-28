import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@maktabi/ui';

export function BrandMark({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  const color = inverse ? colors.white : colors.navy900;
  return (
    <View accessibilityLabel="مكتبي" style={[styles.wrap, compact && styles.compact]}>
      <View style={[styles.badge, inverse && styles.badgeInverse]}>
        <Ionicons name="scale-outline" size={compact ? 28 : 58} color={colors.gold500} />
      </View>
      {!compact ? (
        <>
          <Text style={[styles.arabic, { color }]}>مكتب المحامى</Text>
          <Text style={[styles.latin, { color }]}>LAW OFFICE</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  compact: { flexDirection: 'row-reverse', alignItems: 'center' },
  badge: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.gold500,
    backgroundColor: 'rgba(10, 22, 37, 0.18)',
  },
  badgeInverse: {
    width: 42,
    height: 42,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  arabic: {
    fontFamily: typography.medium,
    fontSize: 31,
    lineHeight: 42,
    letterSpacing: 0.2,
  },
  latin: {
    fontSize: 11,
    letterSpacing: 3,
    opacity: 0.9,
  },
});
