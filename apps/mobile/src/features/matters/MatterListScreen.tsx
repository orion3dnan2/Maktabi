import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { filterMatters, matterStatuses, matterTypes, type Matter, type MatterFilters } from '@maktabi/domain';
import { Button, ChoiceField, choices, colors, elevation, EmptyState, ErrorState, FormPage, LoadingState, typography } from '@maktabi/ui';
import { Chevron, HeroHeader, IconBubble, LuxeCard, Pill, row, rtl, type IonName, type Tone } from '@/components/luxe';
import { matterRepository, OFFICE_ID } from '@/data/repositories';
import { useResource } from '../shared/hooks';

const fetchMatters = () => matterRepository.listByOffice(OFFICE_ID);
const initial: MatterFilters = { query: '', status: '', type: '', authority: '', sort: 'recent' };
const chips = { all: 'الكل', active: 'نشطة', upcoming: 'الجلسات القادمة', closed: 'مغلقة' } as const;
type Chip = keyof typeof chips;
const chipTest: Record<Chip, (m: Matter) => boolean> = { all: () => true, active: (m) => m.status === 'ACTIVE', upcoming: (m) => !!m.nextEventAt, closed: (m) => m.status === 'CLOSED' || m.status === 'ARCHIVED' };
const longDate = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
export function matterBadge(m: Matter): { label: string; tone: Tone; icon?: IonName; dot?: boolean } {
  if (m.status === 'CLOSED' || m.status === 'ARCHIVED') return { label: m.status === 'CLOSED' ? 'مغلقة' : 'مؤرشفة', tone: 'red', icon: 'checkmark-circle-outline' };
  if (m.status === 'ON_HOLD') return { label: 'مؤجلة', tone: 'gold', icon: 'time-outline' };
  return m.nextEventAt ? { label: 'قضية نشطة', tone: 'green', dot: true } : { label: 'بانتظار الجلسة', tone: 'blue', icon: 'time-outline' };
}
function MetaLine({ icon, mc, text }: { icon: string; mc?: boolean; text: string }) {
  const Icon = mc ? MaterialCommunityIcons : Ionicons;
  return <View style={[styles.meta, { flexDirection: row }]}><Icon name={icon as never} size={19} color={colors.navy900}/><Text numberOfLines={1} style={styles.metaText}>{text}</Text></View>;
}

export default function MatterListScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource(fetchMatters);
  const [filters, setFilters] = useState(initial);
  const [chip, setChip] = useState<Chip>('all');
  const [visible, setVisible] = useState(false);
  const rows = useMemo(() => filterMatters(data ?? [], filters).filter(chipTest[chip]), [data, filters, chip]);
  const authorities = [...new Set(data?.flatMap((m) => (m.authority ? [m.authority] : [])) ?? [])];
  const count = [filters.status, filters.type, filters.authority].filter(Boolean).length;
  const set = (key: keyof MatterFilters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const header = <>
    <HeroHeader title="القضايا" subtitle="إدارة ومتابعة جميع القضايا" bottomSpace={8}>
      <View style={[styles.search, { flexDirection: row }]}>
        <Ionicons name="search" size={24} color={colors.navy900}/>
        <TextInput value={filters.query} onChangeText={(v) => set('query', v)} placeholder="البحث في القضايا (رقم القضية، عنوان، عميل)" placeholderTextColor={colors.muted} accessibilityLabel="البحث في القضايا" style={styles.searchInput}/>
        <Pressable accessibilityRole="button" accessibilityLabel="تصفية وترتيب" onPress={() => setVisible(true)} hitSlop={8} style={styles.searchBtn}><Ionicons name="options-outline" size={20} color={colors.navy900}/>{count ? <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View> : null}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="قضية جديدة" onPress={() => router.push('/matters/new')} hitSlop={8} style={[styles.searchBtn, styles.addBtn]}><Ionicons name="add" size={22} color={colors.white}/></Pressable>
      </View>
      <View style={[styles.chips, { flexDirection: row }]}>
        {(Object.keys(chips) as Chip[]).map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: chip === key }} onPress={() => setChip(key)} style={[styles.chip, chip === key && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, chip === key && styles.chipTextActive]}>{chips[key]}</Text></Pressable>)}
      </View>
    </HeroHeader>
    {error ? <ErrorState message={error} onRetry={reload}/> : null}
  </>;
  return <View style={styles.flex}>
    <FlatList data={rows} keyExtractor={(m) => m.id} refreshing={loading && !!data} onRefresh={reload} keyboardShouldPersistTaps="handled" ListHeaderComponent={header} contentContainerStyle={styles.list}
      ListEmptyComponent={loading ? <LoadingState/> : <EmptyState title="لا توجد قضايا مطابقة" message="غيّر التصفية أو أنشئ قضية جديدة."/>}
      renderItem={({ item: m }) => { const badge = matterBadge(m); const client = m.parties.find((p) => p.isPrimary)?.displayName ?? 'غير محدد';
        return <View style={styles.cardWrap}><LuxeCard style={{ padding: 12, gap: 4 }} accessibilityLabel={`فتح القضية ${m.title}`} onPress={() => router.push({ pathname: '/matters/[id]', params: { id: m.id } })}>
          <View style={[styles.cardRow, { flexDirection: row }]}>
            <IconBubble icon="document-text-outline" size={36}/>
            <View style={styles.cardBody}>
              <Text style={styles.ref}>قضية رقم {m.reference}</Text>
            </View>
            <Pill {...badge}/>
          </View>
          <Text numberOfLines={2} style={styles.title}>{m.title}</Text>
          <View style={[styles.cardRow, { flexDirection: row }]}><View style={styles.cardBody}>
            <MetaLine icon="people" text={`العميل: ${client}`}/>
            <MetaLine icon="bank" mc text={m.authority || 'الجهة غير مسجلة'}/>
            <MetaLine icon="calendar-outline" text={m.nextEventAt ? `الجلسة القادمة: ${longDate.format(new Date(m.nextEventAt))}` : m.status === 'CLOSED' ? 'تم إغلاق الملف' : `تاريخ الفتح: ${longDate.format(new Date(m.openedAt))}`}/>
          </View><View style={styles.chev}><Chevron/></View></View>
        </LuxeCard></View>; }}/>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}>
      <FormPage title="تصفية القضايا">
        <ChoiceField label="الحالة" value={filters.status} onChange={(v) => set('status', v)} options={[{ value: '', label: 'كل الحالات' }, ...choices(matterStatuses)]}/>
        <ChoiceField label="النوع" value={filters.type} onChange={(v) => set('type', v)} options={[{ value: '', label: 'كل الأنواع' }, ...choices(matterTypes)]}/>
        <ChoiceField label="المحكمة / الجهة" value={filters.authority} onChange={(v) => set('authority', v)} searchable options={[{ value: '', label: 'كل الجهات' }, ...authorities.map((a) => ({ value: a, label: a }))]}/>
        <ChoiceField label="ترتيب" value={filters.sort} onChange={(v) => set('sort', v)} options={choices({ recent: 'الأحدث فتحاً', reference: 'رقم القضية', next: 'الموعد الأقرب' })}/>
        <Button label={`عرض النتائج (${rows.length})`} onPress={() => setVisible(false)}/>
        <Button label="مسح التصفية" variant="secondary" onPress={() => setFilters({ ...initial, query: filters.query })}/>
      </FormPage>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  list: { paddingBottom: 130 },
  search: { marginTop: 18, minHeight: 60, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', gap: 10, paddingHorizontal: 16, ...elevation.raised },
  searchInput: { flex: 1, minHeight: 48, ...rtl, color: colors.ink, fontFamily: typography.regular, fontSize: 14, outlineStyle: 'none' } as never,
  searchBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold50 },
  addBtn: { backgroundColor: colors.gold500 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 10, fontFamily: typography.bold },
  chips: { marginTop: 16, gap: 6 },
  chip: { flexGrow: 1, minHeight: 44, paddingHorizontal: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(12,33,64,0.65)' },
  chipActive: { backgroundColor: colors.gold100, borderColor: colors.gold400, ...elevation.gold, shadowOpacity: 0.25 },
  chipText: { color: colors.white, fontFamily: typography.medium, fontSize: 14 },
  chipTextActive: { color: colors.navy950, fontFamily: typography.bold },
  cardWrap: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 14, marginTop: 14 },
  cardRow: { gap: 12, alignItems: 'flex-start' },
  cardBody: { flex: 1, gap: 6 },
  ref: { ...rtl, color: colors.muted, fontFamily: typography.medium, fontSize: 14 },
  title: { ...rtl, color: colors.navy950, fontFamily: typography.black, fontSize: 17, lineHeight: 25 },
  meta: { alignItems: 'center', gap: 10 },
  metaText: { flex: 1, ...rtl, color: '#4E5767', fontFamily: typography.regular, fontSize: 14 },
  cardEnd: { alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'space-between' },
  chev: { alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

