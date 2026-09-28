import type { ComponentProps, ReactNode } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { I18nManager, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, gradients, layout, radius, spacing, typography } from '@maktabi/ui';

/** Horizontal direction that lays children out right-to-left on both native (forced RTL) and web. */
export const row = (I18nManager.isRTL ? 'row' : 'row-reverse') as 'row' | 'row-reverse';
export const rtl = { textAlign: 'right' as const, writingDirection: 'rtl' as const };
export type IonName = ComponentProps<typeof Ionicons>['name'];
export type McName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Tone = 'gold' | 'green' | 'blue' | 'red' | 'grey';
const tones: Record<Tone, { bg: string; fg: string }> = {
  gold: { bg: colors.warningBg, fg: colors.warning }, green: { bg: colors.successBg, fg: colors.success }, blue: { bg: colors.infoBg, fg: colors.info }, red: { bg: colors.dangerBg, fg: colors.danger }, grey: { bg: '#EEF0F3', fg: colors.muted },
};
export const toneColor = (tone: Tone) => tones[tone].fg;

/** Bundled artwork keeps the legal-office atmosphere available offline in Expo Go. */
export function HeroBackdrop({ children, style, scales = true }: { children?: ReactNode; style?: StyleProp<ViewStyle>; scales?: boolean }) {
  return <View style={[styles.backdrop, style]}>
    <Image accessible={false} source={require('../../assets/legal-office.png')} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: scales ? '100%' : 580 }]}/>
    <LinearGradient pointerEvents="none" colors={['rgba(6,27,45,0.12)', 'rgba(6,27,45,0.22)', 'rgba(6,27,45,0.92)']} style={StyleSheet.absoluteFill}/>
    {children}
  </View>;
}
export function Emblem({ size = 60 }: { size?: number }) {
  return <View style={[styles.emblem, { width: size, height: size, borderRadius: size / 2 }]}><LinearGradient colors={['#173547', '#061B2D']} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}/><MaterialCommunityIcons name="scale-balance" size={size * 0.5} color={colors.gold400}/></View>;
}
export function RoundIconButton({ icon, onPress, label, dot, bordered }: { icon: IonName; onPress?: () => void; label: string; dot?: boolean; bordered?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.roundBtn, bordered && styles.roundBtnGold, pressed && styles.pressed]}><Ionicons name={icon} size={22} color={bordered ? colors.gold500 : colors.white}/>{dot ? <View style={styles.dot}/> : null}</Pressable>;
}
/** Tall hero used at the top of each tab: bell + emblem row, then a big title and subtitle. */
export function HeroHeader({ title, subtitle, onBell, children, compactTitle, bottomSpace = 44 }: { title: string; subtitle?: string; onBell?: () => void; children?: ReactNode; compactTitle?: boolean; bottomSpace?: number }) {
  const insets = useSafeAreaInsets();
  return <HeroBackdrop style={{ paddingTop: insets.top + spacing.sm }}>
    <View style={styles.heroInner}>
      <View style={[styles.heroTop, { flexDirection: row }]}><Emblem/><RoundIconButton icon="notifications-outline" label="الإشعارات" dot onPress={onBell}/></View>
      <Text style={[styles.heroTitle, compactTitle && { fontSize: 26 }]}>{title}</Text>
      {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
    <View style={{ height: bottomSpace }}/>
  </HeroBackdrop>;
}
/** Content column that overlaps the bottom of the hero like the raised sheets in the mockups. */
export function Sheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[styles.sheet, style]}>{children}</View>; }
export function LuxeCard({ children, style, onPress, dark, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; dark?: boolean; accessibilityLabel?: string }) {
  const body = <><LinearGradient colors={dark ? gradients.navy : gradients.card} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={[StyleSheet.absoluteFill, styles.cardRadius]}/>{children}</>;
  const base = [styles.card, dark && styles.cardDark, style];
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...base, pressed && styles.cardPressed]}>{body}</Pressable> : <View style={base}>{body}</View>;
}
export function IconBubble({ icon, mc, size = 44, variant = 'gold' }: { icon: IonName | McName; mc?: boolean; size?: number; variant?: 'gold' | 'glass' | 'plain' }) {
  const color = variant === 'glass' ? colors.gold400 : colors.gold600;
  const Icon = mc ? MaterialCommunityIcons : Ionicons;
  return <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }, variant === 'glass' && styles.bubbleGlass, variant === 'plain' && styles.bubblePlain]}>
    {variant === 'gold' ? <LinearGradient colors={gradients.goldSoft} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}/> : null}
    <Icon name={icon as never} size={size * 0.48} color={variant === 'plain' ? colors.navy900 : color}/>
  </View>;
}
export function Pill({ label, tone, icon, dot }: { label: string; tone: Tone; icon?: IonName; dot?: boolean }) {
  const t = tones[tone];
  return <View style={[styles.pill, { backgroundColor: t.bg, flexDirection: row }]}>{dot ? <View style={[styles.pillDot, { backgroundColor: t.fg }]}/> : null}{icon ? <Ionicons name={icon} size={15} color={t.fg}/> : null}<Text numberOfLines={1} style={[styles.pillText, { color: t.fg }]}>{label}</Text></View>;
}
export function SectionTitle({ icon, mc, title, action, onAction }: { icon: IonName | McName; mc?: boolean; title: string; action?: string; onAction?: () => void }) {
  const Icon = mc ? MaterialCommunityIcons : Ionicons;
  return <View style={[styles.sectionRow, { flexDirection: row }]}>
    <View style={[styles.sectionStart, { flexDirection: row }]}><Icon name={icon as never} size={22} color={colors.gold600}/><Text style={styles.sectionTitle}>{title}</Text></View>
    {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={[styles.sectionAction, { flexDirection: row }]}><Text style={styles.sectionActionText}>{action}</Text><Ionicons name="chevron-back" size={16} color={colors.navy900}/></Pressable> : null}
  </View>;
}
export function Chevron({ color = colors.gold600 }: { color?: string }) { return <Ionicons name="chevron-back" size={18} color={color}/>; }
export type TimelineItem = { id: string; time: string; date?: string; title: string; subtitle?: string; extra?: string; icon: IonName | McName; mc?: boolean; pill: string; tone: Tone; onPress?: () => void };
/** Pill · icon · text | dot on a rail | time — the schedule/timeline block used across the mockups. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const Icon = (mc?: boolean) => (mc ? MaterialCommunityIcons : Ionicons);
  return <View style={styles.timeline}>
    {items.map((item, i) => { const I = Icon(item.mc); return <Pressable key={item.id} disabled={!item.onPress} onPress={item.onPress} style={({ pressed }) => [styles.tlRow, { flexDirection: row }, i > 0 && styles.tlDivider, pressed && styles.pressed]}>
      <View style={styles.tlPill}><Pill label={item.pill} tone={item.tone}/></View>
      <View style={styles.tlText}><View style={{ flexDirection: row, alignItems: 'center', gap: 5 }}><I name={item.icon as never} size={19} color={colors.navy900}/><Text numberOfLines={2} style={[styles.tlTitle, { flex: 1 }]}>{item.title}</Text></View>{item.subtitle ? <Text numberOfLines={2} style={styles.tlSub}>{item.subtitle}</Text> : null}{item.extra ? <Text numberOfLines={2} style={styles.tlSub}>{item.extra}</Text> : null}</View>
      <View style={styles.tlTime}><View style={styles.rail}/><View style={[styles.tlDot, { backgroundColor: toneColor(item.tone) }]}/><Text style={styles.tlTimeText}>{item.time}</Text>{item.date ? <Text style={styles.tlDate}>{item.date}</Text> : null}</View>
    </Pressable>; })}
  </View>;
}
export function GoldButton({ label, onPress, icon = 'chevron-back' }: { label: string; onPress: () => void; icon?: IonName }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.goldBtn, pressed && styles.pressed]}>
    <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]}/>
    <View style={styles.goldBtnShine}/>
    <Text style={styles.goldBtnText}>{label}</Text>
    <View style={styles.goldBtnIcon}><Ionicons name={icon} size={20} color={colors.white}/></View>
  </Pressable>;
}
export function ActionButton({ label, icon, mc, variant, onPress, grow = 1 }: { label: string; icon: IonName | McName; mc?: boolean; variant: 'navy' | 'green' | 'cream'; onPress: () => void; grow?: number }) {
  const Icon = mc ? MaterialCommunityIcons : Ionicons;
  const fg = variant === 'cream' ? colors.navy900 : colors.white;
  const grad = variant === 'navy' ? gradients.navy : variant === 'green' ? gradients.green : gradients.goldSoft;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.actionBtn, { flexDirection: row, flex: grow }, variant === 'cream' && styles.actionCream, pressed && styles.pressed]}>
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}/>
    <Icon name={icon as never} size={20} color={variant === 'navy' ? colors.gold500 : variant === 'cream' ? colors.gold600 : colors.white}/>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.actionText, { color: fg }]}>{label}</Text>
  </Pressable>;
}
export function Avatar({ size = 46, dark }: { size?: number; dark?: boolean }) {
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, dark && { backgroundColor: colors.navy900 }]}>{dark ? null : <LinearGradient colors={['#F8EBCF', '#EFD9AC']} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}/>}<Ionicons name="person" size={size * 0.5} color={dark ? '#F3E6CB' : colors.gold700}/></View>;
}
export const arabicCount = (n: number, one: string, many: string) => `${n} ${n >= 3 && n <= 10 ? many : one}`;

const styles = StyleSheet.create({
  backdrop: { overflow: 'hidden', backgroundColor: colors.navy950 },
  library: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4 },
  shelf: { position: 'absolute', left: 0, right: 0, height: 52, flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 6 },
  shelfBoard: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: '#2A1D12' },
  scales: { position: 'absolute', left: 4, top: 40, alignItems: 'center', opacity: 0.42 },
  scalesIcon: { textShadowColor: 'rgba(226,194,127,0.55)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
  books: { marginTop: -18, gap: 2, alignItems: 'center' },
  book: { width: 110, height: 10, borderRadius: 3 },
  emblem: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.gold500, ...elevation.gold, shadowOpacity: 0.35 },
  roundBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  roundBtnGold: { backgroundColor: 'rgba(8,22,41,0.5)', borderColor: colors.gold500, borderWidth: 1.5 },
  dot: { position: 'absolute', top: 6, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold400, borderWidth: 1.5, borderColor: colors.navy900 },
  heroInner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.screenGutter + 4, gap: 6 },
  heroTop: { justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  heroTitle: { ...rtl, color: colors.white, fontFamily: typography.black, fontSize: 29, lineHeight: 42, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroSubtitle: { ...rtl, color: '#E3E7EE', fontFamily: typography.medium, fontSize: 15 },
  sheet: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.screenGutter - 2, marginTop: -32, gap: 14, paddingBottom: 120 },
  card: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: '#FFFFFF', borderBottomColor: colors.border, ...elevation.card },
  cardDark: { borderColor: 'rgba(255,255,255,0.12)', borderBottomColor: 'rgba(0,0,0,0.3)', ...elevation.raised },
  cardRadius: { borderRadius: radius.lg },
  cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  pressed: { opacity: 0.75 },
  bubble: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bubbleGlass: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bubblePlain: { backgroundColor: 'transparent' },
  pill: { alignSelf: 'flex-start', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.full },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: typography.bold, fontSize: 11 },
  sectionRow: { justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  sectionStart: { alignItems: 'center', gap: spacing.xs },
  sectionTitle: { ...rtl, color: colors.navy950, fontFamily: typography.black, fontSize: 19 },
  sectionAction: { alignItems: 'center', gap: 4 },
  sectionActionText: { color: colors.navy900, fontFamily: typography.medium, fontSize: 13 },
  timeline: { marginTop: spacing.xs, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  rail: { position: 'absolute', top: -18, bottom: -18, right: -6, width: 1, backgroundColor: '#DDD6C8' },
  tlRow: { alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 6, minHeight: 80 },
  tlDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  tlPill: { width: 72, alignItems: 'center' },
  tlText: { flex: 1, gap: 4 },
  tlTitle: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 14, lineHeight: 20 },
  tlSub: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  tlDot: { position: 'absolute', right: -12, top: '40%', width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: colors.surface },
  tlTime: { width: 72, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', gap: 3, marginRight: 6 },
  tlTimeText: { color: colors.navy950, fontFamily: typography.bold, fontSize: 13, writingDirection: 'rtl' },
  tlDate: { color: colors.muted, fontFamily: typography.regular, fontSize: 11, writingDirection: 'rtl' },
  goldBtn: { minHeight: 60, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', ...elevation.gold, overflow: 'visible' },
  goldBtnShine: { position: 'absolute', top: 2, left: 40, right: 40, height: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  goldBtnText: { color: colors.white, fontFamily: typography.black, fontSize: 24 },
  goldBtnIcon: { position: 'absolute', left: 10, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,22,41,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  actionBtn: { flex: 1, minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, ...elevation.card },
  actionCream: { borderWidth: 1, borderColor: '#EEDDB8' },
  actionText: { flexShrink: 1, fontFamily: typography.bold, fontSize: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#FFF7E6' },
});
