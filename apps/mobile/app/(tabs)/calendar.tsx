import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, EmptyState, ErrorState, LoadingState, typography } from '@maktabi/ui';
import { HeroHeader, LuxeCard, row, SectionTitle, Sheet, Timeline, type TimelineItem } from '@/components/luxe';
import { useAuth } from '@/auth/AuthProvider';
import { canUseMatters } from '@/auth/access';
import { matterRepository, workflowRepository, OFFICE_ID } from '@/data/repositories';
import { useResource } from '@/features/shared/hooks';

const WEEK_MS = 7 * 86400000;
// Appointments are recorded in each matter's workflow on this device (not synchronized yet); the matters come from the server.
const load = async () => {
  const matters = await matterRepository.listActive(OFFICE_ID);
  const now = Date.now();
  return (await Promise.all(matters.map(async (m) => {
    const w = await workflowRepository.getByMatter(m.id);
    return w.appointments.filter((a) => a.status === 'SCHEDULED').map((a) => ({ ...m, appointmentId: a.id, appointmentTitle: a.title, nextEventAt: a.startsAt, inNextWeek: Date.parse(a.startsAt) >= now && Date.parse(a.startsAt) <= now + WEEK_MS }));
  }))).flat();
};
const date = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', numberingSystem: 'latn' });
const time = new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' });
export default function CalendarScreen() {
  const router = useRouter();
  const allowed = canUseMatters(useAuth().access);
  const { data, error, reload } = useResource(useCallback(() => (allowed ? load() : Promise.resolve([])), [allowed]));
  const [filter, setFilter] = useState<'all' | 'week'>('all');
  const items = useMemo<TimelineItem[]>(() => (data ?? []).filter((m) => filter === 'all' || m.inNextWeek).sort((a, b) => a.nextEventAt.localeCompare(b.nextEventAt)).map((m) => ({ id: m.appointmentId, title: m.appointmentTitle, subtitle: m.title, time: time.format(new Date(m.nextEventAt)), date: date.format(new Date(m.nextEventAt)), icon: 'bank', mc: true, pill: 'موعد', tone: 'gold', onPress: () => router.push({ pathname: '/matters/[id]/workflow', params: { id: m.id } }) })), [data, filter, router]);
  return <View style={styles.page}><ScrollView><HeroHeader title="المواعيد" subtitle="جلساتك ومواعيدك المهمة في مكان واحد"/><Sheet>
    <LuxeCard><SectionTitle icon="calendar-outline" title="المواعيد القادمة"/>
      <View style={{ flexDirection: row, gap: 8, marginVertical: 10 }}>{([['all', 'جميع المواعيد'], ['week', 'هذا الأسبوع']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[styles.chip, filter === key && styles.selected]}><Text style={styles.label}>{label}</Text></Pressable>)}</View>
      {error ? <ErrorState message={error} onRetry={reload}/> : !data ? <LoadingState/> : !allowed ? <EmptyState title="لا تملك صلاحية الاطلاع على مواعيد القضايا" message="المواعيد مرتبطة بالقضايا المتاحة لدورك."/> : items.length ? <Timeline items={items}/> : <EmptyState title="لا توجد مواعيد" message="لا توجد جلسات مجدولة خلال هذه الفترة."/>}
      <Text style={styles.note}>المواعيد مسجلة على هذا الجهاز فقط ولا تتم مزامنتها بعد.</Text>
    </LuxeCard>
  </Sheet></ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, chip: { paddingHorizontal: 18, minHeight: 44, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: colors.border }, selected: { backgroundColor: colors.gold100, borderColor: colors.gold500 }, label: { color: colors.navy950, fontFamily: typography.bold, fontSize: 14 }, note: { marginTop: 10, textAlign: 'center', writingDirection: 'rtl', color: colors.muted, fontFamily: typography.regular, fontSize: 11 } });


