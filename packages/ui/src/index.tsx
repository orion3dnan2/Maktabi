import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, fonts, gradients, iconSize, layout, radius, rtl, spacing, tones, type, type Tone } from './theme';
export * from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Gold-ring scales emblem. Temporary identity until the owner supplies production artwork. */
export function Emblem({ size = 64 }: { size?: number }) {
  return <View accessibilityLabel="مكتبي" style={[styles.emblem, { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size / 32) }]}>
    <MaterialCommunityIcons name="scale-balance" size={size * 0.5} color={colors.gold500}/>
  </View>;
}

export function IconButton({ icon, label, onPress, dot = false }: { icon: IconName; label: string; onPress?: () => void; dot?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
    <Ionicons name={icon} size={iconSize.list} color={colors.onDark}/>
    {dot ? <View style={styles.iconDot}/> : null}
  </Pressable>;
}

/** Dark navy page hero from the reference: emblem at the start, action at the end, title and subtitle. */
export function ScreenHero({ title, subtitle, action, onBack, compact = false }: { title: string; subtitle?: string; action?: ReactElement; onBack?: () => void; compact?: boolean }) {
  const insets = useSafeAreaInsets();
  return <LinearGradient colors={gradients.hero} style={[styles.hero, { paddingTop: insets.top + spacing.sm }, compact && styles.heroCompact]}>
    <HeroDecoration/>
    <View style={styles.heroInner}>
      <View style={styles.heroTop}>
        {onBack ? <IconButton icon={rtl.backIcon} label="رجوع" onPress={onBack}/> : <Emblem/>}
        {action ?? <View/>}
      </View>
      <Text accessibilityRole="header" style={type.display}>{title}</Text>
      {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
    </View>
  </LinearGradient>;
}

/** Scales motif standing in for the reference photograph (scales and law books) until a licensed asset exists. */
export function HeroDecoration() {
  return <View pointerEvents="none" style={[styles.decoration, { [rtl.visualLeft]: -48 }]}>
    <MaterialCommunityIcons name="scale-balance" size={176} color={colors.gold500} style={styles.decorationIcon}/>
  </View>;
}

/** Scrollable page: hero, then content that overlaps the hero's lower edge. Leaves room for the tab bar. */
export function HeroScreen({ hero, children, ...scrollProps }: { hero: ComponentProps<typeof ScreenHero>; children: ReactNode } & Omit<ScrollViewProps, 'children'>) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" {...scrollProps}>
    <ScreenHero {...hero}/>
    <View style={styles.overlap}>{children}</View>
  </ScrollView>;
}

export function Card({ children, style, variant = 'light' }: { children: ReactNode; style?: StyleProp<ViewStyle>; variant?: 'light' | 'dark' }) {
  return <View style={[styles.card, variant === 'dark' && styles.cardDark, style]}>{children}</View>;
}

export function SectionHeader({ title, icon, action, onAction }: { title: string; icon?: IconName; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}>
    <View style={styles.row}>{icon ? <Ionicons name={icon} size={iconSize.list} color={colors.gold600}/> : null}<Text accessibilityRole="header" style={type.section}>{title}</Text></View>
    {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={styles.row}><Text style={styles.sectionAction}>{action}</Text><Ionicons name={rtl.forwardIcon} size={iconSize.inline} color={colors.ink}/></Pressable> : null}
  </View>;
}

export function StatusBadge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = tones[tone];
  return <View style={[styles.badge, { backgroundColor: t.bg }]}>{icon ? <Ionicons name={icon} size={14} color={t.fg}/> : null}<Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text></View>;
}
/** @deprecated use StatusBadge */
export const Badge = StatusBadge;

export function IconDisc({ icon, tone = 'gold', size = 44, dark = false }: { icon: IconName; tone?: Tone; size?: number; dark?: boolean }) {
  const t = tones[tone];
  return <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? colors.navy700 : t.bg }}>
    <Ionicons name={icon} size={size * 0.48} color={dark ? colors.gold300 : t.fg}/>
  </View>;
}

export function MetricCard({ label, value, unit, caption, icon, variant = 'light', onPress }: { label: string; value: string; unit?: string; caption: string; icon: IconName; variant?: 'light' | 'dark'; onPress?: () => void }) {
  const dark = variant === 'dark';
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}، ${caption}`} onPress={onPress} style={({ pressed }) => [styles.metric, dark && styles.cardDark, pressed && styles.pressed]}>
    <View style={styles.metricTop}>
      <Text numberOfLines={2} style={[type.label, styles.flex, dark && styles.onDarkMuted]}>{label}</Text>
      <IconDisc icon={icon} dark={dark} size={40}/>
    </View>
    <View style={styles.metricValue}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[type.metric, dark && styles.onDark]}>{value}</Text>
      {unit ? <Text numberOfLines={1} style={[type.caption, styles.flexShrink, dark && styles.onDarkMuted]}>{unit}</Text> : null}
    </View>
    <View style={styles.metricBottom}>
      <Text numberOfLines={1} style={[type.caption, styles.flex, dark && styles.onDarkMuted]}>{caption}</Text>
      <Ionicons name={rtl.forwardIcon} size={iconSize.inline} color={dark ? colors.onDarkMuted : colors.muted}/>
    </View>
  </Pressable>;
}

/** Schedule row: status chip, icon, title/meta, dotted rail and time column (reference "جدول اليوم"). */
export function TimelineRow({ badge, icon, title, meta, time, date, dot, first = false, last = false, onPress }: { badge?: { label: string; tone: Tone }; icon: IconName | ReactElement; title: string; meta?: string; time: string; date?: string; dot: Tone | 'gold'; first?: boolean; last?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${title}، ${time}${date ? ` ${date}` : ''}`} onPress={onPress} style={styles.timelineRow}>
    <View style={[styles.timelineBody, !first && styles.divider]}>
      {badge ? <StatusBadge {...badge}/> : null}
      {typeof icon === 'string' ? <Ionicons name={icon} size={iconSize.list} color={colors.navy900}/> : icon}
      <View style={styles.timelineText}>
        <Text numberOfLines={2} style={type.bodyStrong}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={type.label}>{meta}</Text> : null}
      </View>
    </View>
    <View style={styles.rail}>
      <View style={[styles.railLine, first && styles.railStart, last && styles.railEnd]}/>
      <View style={[styles.railDot, { backgroundColor: dot === 'gold' ? colors.gold500 : tones[dot].fg }]}/>
    </View>
    <View style={[styles.timeCol, first && styles.timeColFirst, last && styles.timeColLast]}>
      <Text style={styles.time}>{time}</Text>
      {date ? <Text numberOfLines={1} style={styles.timeDate}>{date}</Text> : null}
    </View>
  </Pressable>;
}

export function AlertRow({ icon, tone, title, detail, when, first = false }: { icon: IconName; tone: Tone; title: string; detail: string; when?: string; first?: boolean }) {
  return <View style={[styles.alertRow, !first && styles.divider]}>
    <IconDisc icon={icon} tone={tone} size={40}/>
    <View style={styles.flex}><Text style={type.bodyStrong}>{title}</Text><Text style={type.label}>{detail}</Text></View>
    {when ? <View style={styles.row}><View style={[styles.smallDot, { backgroundColor: tones[tone].fg }]}/><Text style={type.caption}>{when}</Text></View> : null}
  </View>;
}

export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
    <IconDisc icon={icon}/>
    <Text numberOfLines={2} style={[type.caption, styles.center, { color: colors.ink }]}>{label}</Text>
  </Pressable>;
}

export function SearchBar(props: TextInputProps) {
  return <View style={styles.search}>
    <Ionicons name="search" size={iconSize.list} color={colors.ink}/>
    <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'البحث'} placeholderTextColor={colors.muted} style={styles.input}/>
  </View>;
}
/** @deprecated use SearchBar */
export const SearchInput = SearchBar;

export function FilterChip({ label, selected = false, onPress, onDark = false }: { label: string; selected?: boolean; onPress?: () => void; onDark?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, onDark && styles.chipOnDark, selected && styles.chipSelected]}>
    <Text style={[type.caption, { color: selected ? colors.navy900 : onDark ? colors.onDark : colors.ink }]}>{label}</Text>
  </Pressable>;
}

export function TextField({ label, icon, error, endAdornment, ...props }: TextInputProps & { label: string; icon?: IconName; error?: string; endAdornment?: ReactNode }) {
  return <View style={styles.field}>
    <View style={[styles.inputWrap, !!error && styles.inputError]}>
      {icon ? <Ionicons name={icon} size={iconSize.list} color={colors.navy900}/> : null}
      <TextInput {...props} accessibilityLabel={label} placeholder={props.placeholder ?? label} placeholderTextColor={colors.muted} style={styles.input}/>
      {endAdornment}
    </View>
    {error ? <Text accessibilityLiveRegion="polite" style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
  </View>;
}
/** @deprecated use TextField */
export const Input = TextField;

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} hitSlop={8} style={styles.checkRow}>
    <View style={[styles.checkbox, checked && styles.checked]}>{checked ? <Ionicons name="checkmark" color={colors.white} size={16}/> : null}</View>
    <Text style={[type.body, { color: colors.ink }]}>{label}</Text>
  </Pressable>;
}

export function PrimaryButton({ label, onPress, disabled = false, showArrow = true }: { label: string; onPress: () => void; disabled?: boolean; showArrow?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryShadow, pressed && styles.pressed, disabled && styles.disabled]}>
    <LinearGradient colors={gradients.gold} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.primary}>
      <Text style={styles.primaryLabel}>{label}</Text>
      {showArrow ? <View style={[styles.primaryArrow, { [rtl.visualLeft]: 8 }]}><Ionicons name="chevron-forward" size={iconSize.list} color={colors.white}/></View> : null}
    </LinearGradient>
  </Pressable>;
}

export function SecondaryButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
    {icon ? <Ionicons name={icon} size={iconSize.list} color={colors.gold500}/> : null}
    <Text style={[styles.primaryLabel, { fontSize: 15 }]}>{label}</Text>
  </Pressable>;
}
/** @deprecated use PrimaryButton / SecondaryButton */
export function Button({ label, onPress, variant = 'primary', disabled }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }) {
  return variant === 'primary' ? <PrimaryButton label={label} onPress={onPress} disabled={disabled} showArrow={false}/> : <SecondaryButton label={label} onPress={onPress}/>;
}

export function Avatar({ initials, size = 44 }: { initials?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold100 }}>
    {initials ? <Text style={[type.caption, { color: colors.gold700 }]}>{initials}</Text> : <Ionicons name="person" size={size * 0.48} color={colors.gold600}/>}
  </View>;
}

export function EmptyState({ title, message, icon = 'albums-outline' }: { title: string; message: string; icon?: IconName }) {
  return <Card style={styles.state}><IconDisc icon={icon} size={56}/><Text style={[type.section, styles.center]}>{title}</Text><Text style={[type.body, styles.center, { color: colors.muted }]}>{message}</Text></Card>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Card style={styles.state}><IconDisc icon="alert-circle-outline" tone="danger" size={56}/><Text style={[type.section, styles.center, { color: colors.danger }]}>تعذر تحميل البيانات</Text><Text style={[type.body, styles.center, { color: colors.muted }]}>{message}</Text>{onRetry ? <SecondaryButton label="إعادة المحاولة" icon="refresh" onPress={onRetry}/> : null}</Card>;
}
export function LoadingState() {
  return <View accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.gold600}/><Text style={[type.body, { color: colors.muted }]}>جارٍ التحميل…</Text></View>;
}
export function OfflineBanner() { return <View style={styles.offline}><Text style={[type.caption, { color: colors.navy900 }]}>أنت غير متصل — ستُحفظ تغييراتك على هذا الجهاز</Text></View>; }

/** Matter card from the reference matter list. Presentational only. */
export function MatterCard({ reference, title, client, authority, nextEvent, status, onPress }: { reference: string; title: string; client: string; authority?: string; nextEvent?: string; status: { label: string; tone: Tone }; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={[styles.card, styles.matter]}>
    <View style={[styles.flex, { gap: spacing.xxs }]}>
      <View style={styles.rowBetween}><View style={styles.row}><IconDisc icon="document-text-outline" size={40}/><Text style={type.label}>{reference}</Text></View><StatusBadge {...status}/></View>
      <Text style={type.section}>{title}</Text>
      <MetaLine icon="people" text={`العميل: ${client}`}/>
      {authority ? <MetaLine icon="business-outline" text={authority}/> : null}
      {nextEvent ? <MetaLine icon="calendar-outline" text={nextEvent}/> : null}
    </View>
    {onPress ? <Ionicons name={rtl.forwardIcon} size={iconSize.list} color={colors.gold700}/> : null}
  </Pressable>;
}
export function ClientCard({ name, subtitle, trailing, onPress }: { name: string; subtitle: string; trailing?: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={styles.alertRow}>
    <Avatar/><View style={styles.flex}><Text style={type.bodyStrong}>{name}</Text><Text style={type.label}>{subtitle}</Text></View>
    {trailing ? <Text style={type.caption}>{trailing}</Text> : null}
    {onPress ? <Ionicons name={rtl.forwardIcon} size={iconSize.inline} color={colors.muted}/> : null}
  </Pressable>;
}
function MetaLine({ icon, text }: { icon: IconName; text: string }) {
  return <View style={styles.row}><Ionicons name={icon} size={iconSize.inline} color={colors.navy900}/><Text style={[type.label, styles.flex]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, flexShrink: { flexShrink: 1 }, center: { textAlign: 'center' }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.45 },
  onDark: { color: colors.onDark }, onDarkMuted: { color: colors.onDarkMuted },
  row: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs },
  rowBetween: { flexDirection: rtl.row, alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },

  emblem: { alignItems: 'center', justifyContent: 'center', borderColor: colors.gold500, backgroundColor: colors.navy900, ...elevation.raised },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF1F', borderWidth: 1, borderColor: '#FFFFFF26' },
  iconDot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold500, borderWidth: 1.5, borderColor: colors.navy900 },

  hero: { overflow: 'hidden', paddingBottom: layout.heroOverlap + spacing.lg },
  heroCompact: { paddingBottom: layout.heroOverlap + spacing.xs },
  heroInner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.screenGutter + spacing.xxs, gap: spacing.xxs },
  heroTop: { flexDirection: rtl.row, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  heroSubtitle: { ...type.body, color: colors.onDarkMuted },
  decoration: { position: 'absolute', top: 18, width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  decorationIcon: { opacity: 0.12 },

  page: { flex: 1, backgroundColor: colors.canvas },
  pageContent: { paddingBottom: spacing.xxl },
  overlap: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', marginTop: -layout.heroOverlap, paddingHorizontal: layout.screenGutter, gap: layout.sectionGap },

  card: { padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
  cardDark: { backgroundColor: colors.navy800, borderColor: colors.navy700 },
  sectionHeader: { minHeight: 40, flexDirection: rtl.row, justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs },
  sectionAction: { ...type.caption, color: colors.ink },

  badge: { flexDirection: rtl.row, alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: spacing.sm },
  badgeText: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 19 },

  metric: { flex: 1, minWidth: 0, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
  metricTop: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs },
  metricValue: { flexDirection: rtl.row, alignItems: 'baseline', gap: spacing.xxs },
  metricBottom: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs },

  timelineRow: { flexDirection: rtl.row, alignItems: 'stretch', minHeight: 72 },
  timelineBody: { flex: 1, flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  timelineText: { flex: 1, gap: 2 },
  rail: { width: 24, alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.border },
  railStart: { top: '50%' }, railEnd: { bottom: '50%' },
  railDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.surface },
  timeCol: { width: 84, justifyContent: 'center', paddingHorizontal: spacing.xs, backgroundColor: colors.surfaceMuted },
  timeColFirst: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md }, timeColLast: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  time: { ...type.bodyStrong, fontFamily: fonts.bold, textAlign: 'center' },
  timeDate: { ...type.caption, textAlign: 'center' },

  alertRow: { minHeight: 64, flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  smallDot: { width: 6, height: 6, borderRadius: 3 },
  quick: { flex: 1, minHeight: 84, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xxs },

  search: { minHeight: 56, flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.input, backgroundColor: colors.surface, ...elevation.card },
  input: { flex: 1, minHeight: 48, ...type.body, color: colors.ink },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOnDark: { backgroundColor: 'transparent', borderColor: '#FFFFFF40' },
  chipSelected: { backgroundColor: colors.gold100, borderColor: colors.gold300 },

  field: { gap: spacing.xxs },
  inputWrap: { minHeight: 56, flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, backgroundColor: colors.surface },
  inputError: { borderColor: colors.danger },
  checkRow: { minHeight: 44, flexDirection: rtl.row, alignItems: 'center', gap: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.gold600, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.gold600 },

  primaryShadow: { borderRadius: radius.full, ...elevation.raised, shadowColor: colors.gold600, shadowOpacity: 0.35 },
  primary: { minHeight: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  primaryLabel: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.white, textAlign: 'center' },
  primaryArrow: { position: 'absolute', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000024', borderWidth: 1, borderColor: '#FFFFFF33' },
  secondary: { minHeight: layout.minTouchTarget, flexDirection: rtl.row, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.navy900 },

  state: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  offline: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.gold100 },
  matter: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm },
});
