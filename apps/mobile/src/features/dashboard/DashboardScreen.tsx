import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, EmptyState, ErrorState, LoadingState, typography } from '@maktabi/ui';
import { Chevron, HeroHeader, IconBubble, LuxeCard, row, rtl, SectionTitle, Sheet, Timeline, type IonName, type McName, type TimelineItem } from '@/components/luxe';
import { dashboardRepository } from '@/data/mockDashboardRepository';
import { clientRepository, matterRepository, OFFICE_ID } from '@/data/repositories';
import { money, useResource } from '../shared/hooks';

const time = new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, numberingSystem: 'latn' });
const load = async () => {
  const [snapshot, clients, active] = await Promise.all([dashboardRepository.getSnapshot(), clientRepository.listByOffice(OFFICE_ID), matterRepository.listActive(OFFICE_ID)]);
  return { snapshot, clients: clients.length, active: active.length, upcoming: active.filter((m) => m.nextEventAt).length };
};

function StatTile({ title, value, caption, icon, mc, dark, onPress }: { title: string; value: number; caption: string; icon: IonName | McName; mc?: boolean; dark?: boolean; onPress: () => void }) {
  return <LuxeCard dark={dark} onPress={onPress} accessibilityLabel={`${title}: ${value}`} style={styles.tile}>
    <View style={[styles.tileRow, { flexDirection: row }]}>
      <View style={styles.tileText}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileTitle, dark && styles.onDark]}>{title}</Text>
        <Text style={[styles.tileValue, dark && styles.onDark]}>{value}</Text>
        <Text numberOfLines={1} style={[styles.tileCaption, dark && styles.onDarkMuted]}>{caption}</Text>
      </View>
      <View style={styles.tileSide}><IconBubble icon={icon} mc={mc} size={36} variant={dark ? 'glass' : 'gold'}/><Chevron color={dark ? colors.gold400 : colors.gold600}/></View>
    </View>
  </LuxeCard>;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource(load);
  if (error) return <View style={styles.flex}><HeroHeader title="مرحباً"/><ErrorState message={error} onRetry={reload}/></View>;
  if (!data) return <View style={styles.flex}><HeroHeader title="مرحباً"/><LoadingState/></View>;
  const { snapshot } = data;
  const firstName = snapshot.currentUser.fullName.split(' ')[0] ?? snapshot.currentUser.fullName;
  const agenda: TimelineItem[] = [
    ...snapshot.todaysSessions.map((s): TimelineItem => ({ id: s.id, time: time.format(new Date(s.startsAt)), title: s.title, subtitle: s.authority, icon: 'bank', mc: true, pill: 'اليوم', tone: 'gold', onPress: () => router.push({ pathname: '/matters/[id]/workflow', params: { id: s.matterId } }) })),
    ...snapshot.upcomingDeadlines.map((d): TimelineItem => ({ id: d.id, time: time.format(new Date(d.dueAt)), title: d.priority === 'URGENT' ? 'موعد نهائي' : 'مراجعة مستندات', subtitle: d.title, icon: d.priority === 'URGENT' ? 'time-outline' : 'document-text', pill: d.priority === 'URGENT' ? 'مهم' : 'قيد التنفيذ', tone: d.priority === 'URGENT' ? 'red' : 'blue', onPress: () => router.push({ pathname: '/matters/[id]', params: { id: d.matterId } }) })),
  ].sort((a, b) => (a.pill === 'مهم' ? 1 : 0) - (b.pill === 'مهم' ? 1 : 0));
  const urgent = snapshot.upcomingDeadlines.find((d) => d.priority === 'URGENT');
  const alerts = [
    ...(urgent ? [{ id: 'u', title: 'موعد نهائي قريب', body: urgent.title, when: 'عاجل', icon: 'alert-circle-outline' as IonName, color: colors.danger }] : []),
    ...snapshot.recentActivity.slice(0, 3).map((a) => ({ id: a.id, title: a.title, body: a.detail, when: 'حديثاً', icon: 'document-text-outline' as IonName, color: colors.gold600 })),
  ];
  const goMatters = () => router.push('/(tabs)/matters');
  return <View style={styles.flex}>
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.gold500}/>}>
      <HeroHeader title={`مرحباً أستاذ ${firstName}`} subtitle="نظرة سريعة على أعمال اليوم" onBell={() => Alert.alert('الإشعارات', 'لا توجد إشعارات جديدة.')}/>
      <Sheet>
        <View style={[styles.grid, { flexDirection: row }]}>
          <StatTile dark title="الجلسات القادمة" value={data.upcoming} caption="قضايا لها موعد" icon="calendar-outline" onPress={() => router.push('/(tabs)/calendar')}/>
          <StatTile title="القضايا النشطة" value={data.active} caption="قضية نشطة حالياً" icon="people" onPress={goMatters}/>
          <StatTile title="المهام المطلوبة" value={snapshot.upcomingDeadlines.length + snapshot.overdueFeeItems} caption="مهام بحاجة إلى متابعة" icon="clipboard-text-outline" mc onPress={goMatters}/>
          <StatTile dark title="العملاء" value={data.clients} caption="عميل نشط" icon="account-group" mc onPress={() => router.push('/(tabs)/clients')}/>
        </View>
        <LuxeCard><SectionTitle icon="wallet-outline" title="الأتعاب المتبقية"/><Text style={styles.tileValue}>{money(snapshot.outstandingFees.amountMinor)}</Text><Text style={styles.tileCaption}>إجمالي المتبقي من اتفاقات العملاء</Text></LuxeCard>
        <LuxeCard>
          <SectionTitle icon="calendar-outline" title="جدول اليوم" action="عرض الكل" onAction={() => router.push('/(tabs)/calendar')}/>
          {agenda.length ? <Timeline items={agenda}/> : <EmptyState title="لا توجد جلسات اليوم" message="أضف موعداً من مسار القضية ليظهر هنا وفي التقويم."/>}
        </LuxeCard>
        <LuxeCard>
          <SectionTitle icon="notifications" title="آخر النشاط"/>
          {!alerts.length ? <Text style={styles.alertBody}>لا توجد عمليات جديدة بعد.</Text> : null}
          {alerts.map((a, i) => <Pressable key={a.id} style={[styles.alert, { flexDirection: row }, i > 0 && styles.divider]}>
            <View style={styles.alertIcon}><Ionicons name={a.icon} size={26} color={a.color}/></View>
            <View style={styles.alertText}><Text style={styles.alertTitle}>{a.title}</Text><Text numberOfLines={2} style={styles.alertBody}>{a.body}</Text></View>
            <View style={[styles.alertDot, { backgroundColor: a.color }]}/>
            <Text style={styles.alertWhen}>{a.when}</Text>
          </Pressable>)}
        </LuxeCard>
        <Text style={styles.disclaimer}>جميع الأسماء والمواعيد المعروضة بيانات تجريبية.</Text>
      </Sheet>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  grid: { flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 105, justifyContent: 'center', paddingHorizontal: 10 },
  tileRow: { alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  tileText: { flex: 1, gap: 2 },
  tileTitle: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 12 },
  tileValue: { ...rtl, color: colors.navy950, fontFamily: typography.black, fontSize: 30, lineHeight: 36 },
  tileCaption: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  tileSide: { alignItems: 'center', gap: 18 },
  onDark: { color: colors.white },
  onDarkMuted: { color: '#C9D1DD' },
  alert: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  alertIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold50, borderWidth: 1, borderColor: colors.gold100 },
  alertText: { flex: 1, gap: 4 },
  alertTitle: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 15 },
  alertBody: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertWhen: { width: 70, color: colors.muted, fontFamily: typography.regular, fontSize: 12, textAlign: 'center' },
  disclaimer: { ...rtl, textAlign: 'center', color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
});


