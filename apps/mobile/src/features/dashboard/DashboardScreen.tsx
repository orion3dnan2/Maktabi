import { useCallback, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { DashboardActivity, DashboardSnapshot, Session } from '@maktabi/domain';
import { AlertRow, Card, colors, ErrorState, HeroScreen, type IconName, LoadingState, MetricCard, QuickAction, rtl, SectionHeader, spacing, TimelineRow, type Tone, type } from '@maktabi/ui';
import { NotificationsButton } from '@/components/NotificationsButton';
import { dashboardRepository } from '@/data/mockDashboardRepository';
import { countLabel, currencyLabel, formatCompact, formatDayMonth, formatInteger, formatTime, relativeDay, relativePast, units } from '@/lib/format';

const sessionStatus: Record<Session['status'], { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'مجدولة', tone: 'gold' }, COMPLETED: { label: 'منعقدة', tone: 'success' },
  ADJOURNED: { label: 'مؤجلة', tone: 'warning' }, CANCELLED: { label: 'ملغاة', tone: 'danger' },
};
const activityIcon: Record<DashboardActivity['kind'], { icon: IconName; tone: Tone }> = {
  MATTER: { icon: 'folder-open-outline', tone: 'gold' }, CLIENT: { icon: 'person-add-outline', tone: 'info' },
  DOCUMENT: { icon: 'document-text-outline', tone: 'neutral' }, PAYMENT: { icon: 'cash-outline', tone: 'success' },
};
const quickActions: { icon: IconName; label: string }[] = [
  { icon: 'folder-open-outline', label: 'ملف جديد' }, { icon: 'person-add-outline', label: 'عميل جديد' },
  { icon: 'camera-outline', label: 'تصوير مستند' }, { icon: 'cash-outline', label: 'تسجيل دفعة' },
];

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardSnapshot>(); const [error, setError] = useState(''); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setError(''); setData(await dashboardRepository.getSnapshot()); }
    catch { setError('تحقق من البيانات المحلية وحاول مرة أخرى.'); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const firstName = data?.currentUser.fullName.split(' ')[0] ?? '';
  const hero = { title: data ? `مرحباً أستاذ ${firstName}` : 'مكتبي', subtitle: data ? `${data.office.name} · نظرة سريعة على أعمال اليوم` : undefined, action: <NotificationsButton unread={!!data?.upcomingDeadlines.length}/> };
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.gold500}/>;

  if (error) return <HeroScreen hero={hero}><ErrorState message={error} onRetry={() => void load()}/></HeroScreen>;
  if (!data) return <HeroScreen hero={hero}><Card><LoadingState/></Card></HeroScreen>;

  const now = new Date();
  const sessions = [...data.todaysSessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const deadlines = [...data.upcomingDeadlines].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const fees = formatCompact(data.outstandingFees.amountMinor / 100);
  const comingSoon = (label: string) => Alert.alert(label, 'ستتوفر هذه الوظيفة في دفعة لاحقة.');

  return <HeroScreen hero={hero} refreshControl={refresh}>
    <View style={styles.metricRow}>
      <MetricCard variant="dark" icon="calendar-outline" label="جلسات اليوم" value={formatInteger(sessions.length)} caption={sessions.length ? `أولها ${formatTime(sessions[0]!.startsAt)}` : 'لا جلسات اليوم'} onPress={() => router.navigate('/calendar')}/>
      <MetricCard icon="folder-open-outline" label="الملفات النشطة" value={formatInteger(data.activeMatters)} caption="ملف نشط حالياً" onPress={() => router.navigate('/matters')}/>
    </View>
    <View style={styles.metricRow}>
      <MetricCard icon="alarm-outline" label="المواعيد القريبة" value={formatInteger(deadlines.length)} caption={deadlines.length ? `أقربها ${relativeDay(deadlines[0]!.dueAt, now)}` : 'لا مواعيد مفتوحة'}/>
      <MetricCard variant="dark" icon="cash-outline" label="الأتعاب المستحقة" value={fees.value} unit={[fees.scale, currencyLabel(data.outstandingFees.currency)].filter(Boolean).join(' ')} caption={`${countLabel(data.overdueFeeItems, units.item)} متأخرة`}/>
    </View>

    <Card>
      <SectionHeader icon="calendar-clear-outline" title="جدول اليوم" action="عرض الكل" onAction={() => router.navigate('/calendar')}/>
      {sessions.length ? <View>{sessions.map((session, i) => <TimelineRow key={session.id} first={i === 0} last={i === sessions.length - 1}
        badge={sessionStatus[session.status]} dot={sessionStatus[session.status].tone} icon={<MaterialCommunityIcons name="bank-outline" size={20} color={colors.navy900}/>}
        title={session.title} meta={[session.authority, session.room].filter(Boolean).join(' · ')} time={formatTime(session.startsAt)}/>)}</View>
        : <Text style={[type.body, styles.empty]}>لا توجد جلسات مجدولة اليوم</Text>}
    </Card>

    <Card>
      <SectionHeader icon="notifications" title="تنبيهات مهمة"/>
      {deadlines.map((deadline, i) => <AlertRow key={deadline.id} first={i === 0}
        icon={deadline.priority === 'URGENT' ? 'alert-circle-outline' : 'time-outline'} tone={deadline.priority === 'URGENT' ? 'danger' : 'gold'}
        title={deadline.title} detail={`${deadline.source === 'USER_ENTERED' ? 'موعد أدخله المستخدم' : 'موعد من قاعدة مهيأة'} · ${formatDayMonth(deadline.dueAt)}`} when={relativeDay(deadline.dueAt, now)}/>)}
      {data.overdueFeeItems ? <AlertRow first={!deadlines.length} icon="cash-outline" tone="warning" title="أتعاب تحتاج متابعة" detail={`${countLabel(data.overdueFeeItems, units.item)} من الأتعاب المستحقة متأخرة`}/> : null}
      {!deadlines.length && !data.overdueFeeItems ? <Text style={[type.body, styles.empty]}>لا توجد تنبيهات</Text> : null}
    </Card>

    <Card>
      <SectionHeader icon="flash-outline" title="إجراءات سريعة"/>
      <View style={styles.quickRow}>{quickActions.map((action) => <QuickAction key={action.label} {...action} onPress={() => comingSoon(action.label)}/>)}</View>
    </Card>

    <Card>
      <SectionHeader icon="time-outline" title="آخر النشاطات"/>
      {data.recentActivity.map((item, i) => <AlertRow key={item.id} first={i === 0} {...activityIcon[item.kind]} title={item.title} detail={item.detail} when={relativePast(item.happenedAt, now)}/>)}
    </Card>

    <Text style={[type.caption, styles.disclaimer]}>جميع الأسماء والمواعيد المعروضة بيانات تجريبية غير قانونية أو ملزمة.</Text>
  </HeroScreen>;
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: rtl.row, gap: spacing.sm },
  quickRow: { flexDirection: rtl.row, gap: spacing.xs },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg },
  disclaimer: { textAlign: 'center', paddingVertical: spacing.xs },
});
