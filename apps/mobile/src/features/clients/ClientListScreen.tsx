import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clientKinds, filterClients, matterTypes, type MatterType } from '@maktabi/domain';
import { colors, elevation, EmptyState, ErrorState, LoadingState, typography } from '@maktabi/ui';
import { ActionButton, arabicCount, Avatar, Chevron, HeroHeader, LuxeCard, Pill, row, rtl, SectionTitle, Sheet, Timeline, type TimelineItem, type Tone } from '@/components/luxe';
import { clientRepository, matterRepository, OFFICE_ID, profileRepository } from '@/data/repositories';
import { useResource } from '../shared/hooks';
import { isUnlocked } from '@/data/vault';
import type { ClientProfileData } from '@/data/mockRepositories';

const fetchClients = async () => {
  const [clients, matters] = await Promise.all([clientRepository.listByOffice(OFFICE_ID), matterRepository.listByOffice(OFFICE_ID)]);
  const profiles = isUnlocked() ? new Map(await Promise.all(clients.map(async (c) => [c.id, await profileRepository.getByClient(c.id)] as const))) : new Map<string, ClientProfileData>();
  const counts = new Map<string, number>();
  for (const m of matters) if (m.status === 'ACTIVE') for (const id of new Set(m.parties.map((p) => p.clientId))) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return { clients, matters, profiles, counts };
};
const LRM = String.fromCharCode(0x200e); // keeps "+249…" phone numbers left-to-right inside RTL text
const clock = new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, numberingSystem: 'latn' });
const weekday = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', numberingSystem: 'latn' });
const kindPill = (t: MatterType): { pill: string; tone: Tone; icon: string; mc?: boolean } =>
  t === 'NOTARIZATION' || t === 'OTHER' ? { pill: 'استشارة', tone: 'green', icon: 'document-text' } : t === 'LABOUR' || t === 'PERSONAL_STATUS' ? { pill: 'اجتماع', tone: 'blue', icon: 'people' } : { pill: 'جلسة', tone: 'gold', icon: 'bank', mc: true };

export default function ClientListScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource(fetchClients);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const filtered = useMemo(() => filterClients(data?.clients ?? [], query, kind), [data, query, kind]);
  const open = (id: string) => router.push({ pathname: '/clients/[id]', params: { id } });
  const featured = useMemo(() => data ? [...data.clients].sort((a, b) => (data.counts.get(b.id) ?? 0) - (data.counts.get(a.id) ?? 0))[0] : undefined, [data]);
  const upcoming: TimelineItem[] = useMemo(() => (data?.matters ?? []).filter((m) => m.nextEventAt).sort((a, b) => a.nextEventAt!.localeCompare(b.nextEventAt!)).slice(0, 3).map((m) => {
    const k = kindPill(m.type); const d = new Date(m.nextEventAt!);
    return { id: m.id, time: clock.format(d), date: weekday.format(d), title: m.parties.find((p) => p.isPrimary)?.displayName ?? m.title, subtitle: `${k.pill} — ${m.title} (${matterTypes[m.type]})`, icon: k.icon as never, mc: k.mc, pill: k.pill, tone: k.tone, onPress: () => router.push({ pathname: '/matters/[id]', params: { id: m.id } }) };
  }), [data, router]);
  const preview = (title: string, body: string) => Alert.alert(title, `${body}\nالاتصال والمشاركة المباشرة لم يُفعّلا في هذه الشاشة بعد.`);
  const featuredProfile = featured ? data?.profiles.get(featured.id) : undefined;
  return <View style={styles.flex}>
    <ScrollView keyboardShouldPersistTaps="handled">
      <HeroHeader title="العملاء والمواعيد" subtitle="إدارة علاقات العملاء ومتابعة المواعيد بكل سهولة" compactTitle/>
      <Sheet>
        {error ? <ErrorState message={error} onRetry={reload}/> : null}
        {!data && loading ? <LoadingState/> : null}
        {featured ? <LuxeCard>
          <View style={[styles.featuredTop, { flexDirection: row }]}>
            <Avatar size={44}/>
            <View style={styles.flex1}>
              <Pill label="العميل المميز" tone="gold" icon="star"/>
              <Text numberOfLines={2} style={styles.featuredName}>{featured.displayName}</Text>
              <Text style={styles.muted}>عميل مسجل · {clientKinds[featured.kind]}</Text>
              <View style={[styles.phoneRow, { flexDirection: row }]}><Ionicons name="call" size={16} color={colors.navy900}/><Text style={styles.phone}>{LRM + featured.phone}</Text></View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="فتح ملف العميل" onPress={() => open(featured.id)} style={[styles.miniCard, { flexDirection: row }]}>
              <Chevron color={colors.navy900}/>
              <View style={styles.miniBody}><View style={[styles.miniRow, { flexDirection: row }]}><Ionicons name="calendar-outline" size={20} color={colors.gold600}/><Text style={styles.miniTitle}>{arabicCount(data!.counts.get(featured.id) ?? 0, 'قضية', 'قضايا')}</Text></View><Text style={styles.miniMeta}>آخر تواصل</Text><Text style={styles.miniMeta}>{featuredProfile?.activity[0]?.date ?? '—'}</Text></View>
            </Pressable>
          </View>
          <View style={[styles.actions, { flexDirection: row }]}>
            <ActionButton variant="navy" icon="call" label="اتصال" onPress={() => preview('معاينة الاتصال', `الهاتف: ${featured.phone}`)}/>
            <ActionButton variant="green" icon="logo-whatsapp" label="واتساب" onPress={() => preview('معاينة واتساب', `الرقم: ${featured.whatsapp || featured.phone}`)}/>
            <ActionButton variant="cream" grow={1.3} icon="document-text-outline" label="إضافة ملاحظة" onPress={() => router.push({ pathname: '/clients/[id]/edit', params: { id: featured.id } })}/>
          </View>
        </LuxeCard> : null}
        {upcoming.length ? <LuxeCard>
          <SectionTitle icon="calendar-outline" title="المواعيد القادمة" action="عرض الكل" onAction={() => router.push('/(tabs)/calendar')}/>
          <Timeline items={upcoming}/>
        </LuxeCard> : null}
        <LuxeCard>
          <SectionTitle icon="account-group" mc title="قائمة العملاء" action="عميل جديد" onAction={() => router.push('/clients/new')}/>
          <View style={[styles.search, { flexDirection: row }]}>
            <Ionicons name="search" size={20} color={colors.navy900}/>
            <TextInput value={query} onChangeText={setQuery} placeholder="اسم العميل أو رقم الهاتف" placeholderTextColor={colors.muted} accessibilityLabel="البحث في العملاء" style={styles.searchInput}/>
          </View>
          <View style={[styles.filters, { flexDirection: row }]}>
            {[['', 'الكل'], ...Object.entries(clientKinds)].map(([value, label]) => <Pressable key={value} onPress={() => setKind(value!)} accessibilityRole="button" accessibilityState={{ selected: kind === value }} style={[styles.filter, kind === value && styles.filterActive]}><Text style={[styles.filterText, kind === value && styles.filterTextActive]}>{label}</Text></Pressable>)}
          </View>
          {data && !filtered.length ? <EmptyState title="لا يوجد عملاء" message="أضف عميلاً جديداً أو غيّر البحث والتصفية."/> : null}
          {filtered.map((c, i) => { const n = data?.counts.get(c.id) ?? 0;
            return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`فتح ملف العميل ${c.displayName}`} onPress={() => open(c.id)} style={({ pressed }) => [styles.clientRow, { flexDirection: row }, i > 0 && styles.divider, pressed && { opacity: 0.7 }]}>
              <Avatar size={50}/>
              <View style={styles.flex1}><Text numberOfLines={1} style={styles.clientName}>{c.displayName}</Text><Text style={styles.muted}>عميل مسجل</Text></View>
              <View style={[styles.miniRow, { flexDirection: row }]}><Ionicons name="calendar-outline" size={22} color={colors.gold600}/><Text style={styles.count}>{arabicCount(n, 'قضية', 'قضايا')}</Text></View>
              <Chevron color={colors.navy900}/>
            </Pressable>; })}
        </LuxeCard>
        <Text style={styles.disclaimer}>العملاء والقضايا محفوظة محلياً وتُزامن مع المكتب عند توفر الاتصال.</Text>
      </Sheet>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  flex1: { flex: 1, gap: 4 },
  featuredTop: { alignItems: 'center', gap: 8 },
  featuredName: { ...rtl, color: colors.navy950, fontFamily: typography.black, fontSize: 18, lineHeight: 25 },
  muted: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  phoneRow: { alignItems: 'center', gap: 6 },
  phone: { color: colors.navy950, fontFamily: typography.medium, fontSize: 13, writingDirection: 'ltr' },
  miniCard: { width: 90, alignItems: 'center', gap: 3, padding: 6, borderRadius: 14, backgroundColor: colors.gold50, borderWidth: 1, borderColor: colors.gold100, alignSelf: 'stretch' },
  miniRow: { alignItems: 'center', gap: 6 },
  miniBody: { flexShrink: 1, gap: 4 },
  miniMeta: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  miniTitle: { color: colors.navy950, fontFamily: typography.bold, fontSize: 15 },
  actions: { gap: 10, marginTop: 10 },
  search: { minHeight: 48, borderRadius: 14, alignItems: 'center', gap: 8, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card, shadowOpacity: 0.05 },
  searchInput: { flex: 1, minHeight: 44, ...rtl, color: colors.ink, fontFamily: typography.regular, fontSize: 14, outlineStyle: 'none' } as never,
  filters: { gap: 8, marginTop: 4 },
  filter: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  filterText: { color: colors.navy900, fontFamily: typography.medium, fontSize: 13 },
  filterTextActive: { color: colors.gold400 },
  clientRow: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  clientName: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 16 },
  count: { color: colors.navy900, fontFamily: typography.medium, fontSize: 14 },
  disclaimer: { ...rtl, textAlign: 'center', color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
});


