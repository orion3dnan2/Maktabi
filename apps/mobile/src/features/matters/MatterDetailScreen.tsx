import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matterTypes } from '@maktabi/domain';
import { Button, colors, ErrorState, gradients, layout, LoadingState, typography } from '@maktabi/ui';
import { Avatar, Chevron, HeroBackdrop, IconBubble, LuxeCard, Pill, RoundIconButton, row, rtl, SectionTitle, Timeline, type IonName, type McName, type TimelineItem } from '@/components/luxe';
import { matterRepository, workflowRepository } from '@/data/repositories';
import { paidTotal } from '@/data/workflow';
import { money, useResource } from '../shared/hooks';
import { useOperation } from '../shared/useOperation';
import { matterBadge } from './MatterListScreen';
import { BottomNavigation } from '@/components/BottomNavigation';

const day = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
const clock = new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, numberingSystem: 'latn' });
const slash = (iso: string) => day.format(new Date(iso)).replaceAll('-', '/');

function Tile({ icon, mc, title, children, action, onAction, style }: { icon: IonName | McName; mc?: boolean; title: string; children: ReactNode; action?: string; onAction?: () => void; style?: object }) {
  const Icon = mc ? MaterialCommunityIcons : Ionicons;
  return <LuxeCard style={[styles.tile, style]}>
    <View style={[styles.tileHead, { flexDirection: row }]}><Icon name={icon as never} size={22} color={colors.gold600}/><Text style={styles.tileTitle}>{title}</Text></View>
    {children}
    {action ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.tileAction, { flexDirection: row }, pressed && { opacity: 0.7 }]}><Text style={styles.tileActionText}>{action}</Text><Chevron/></Pressable> : null}
  </LuxeCard>;
}
function Party({ name, role, avatar }: { name: string; role: string; avatar?: boolean }) {
  return <View style={[styles.party, { flexDirection: row }]}>{avatar ? <Avatar size={34} dark/> : <IconBubble icon="office-building" mc size={34}/>}<View style={styles.flex1}><Text numberOfLines={2} style={styles.partyName}>{name}</Text><Text style={styles.partyRole}>{role}</Text></View></View>;
}

export default function MatterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fetcher = useCallback(async () => {
    const matter = await matterRepository.getById(id);
    if (!matter) throw new Error('القضية غير موجودة');
    const clientId = matter.parties.find((p) => p.isPrimary)?.clientId;
    const workflow = await workflowRepository.getByMatter(id);
    return { matter, workflow, clientId, loadedAt: Date.now() };
  }, [id]);
  const { data, error, reload } = useResource(fetcher);
  const op = useOperation(reload);
  const [archiving, setArchiving] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/matters'));
  if (error) return <View style={styles.page}><ErrorState message={error} onRetry={reload}/><Button label="القضايا" onPress={back}/></View>;
  if (!data) return <View style={styles.page}><LoadingState/></View>;
  const { matter: m, workflow, clientId, loadedAt } = data;
  const edit = () => router.push({ pathname: '/matters/[id]/edit', params: { id } });
  const badge = matterBadge(m);
  const client = m.parties.find((p) => p.isPrimary);
  const opponent = m.parties.find((p) => p.role === 'OPPONENT');
  const paid = paidTotal(workflow); const agreed = workflow.agreedFees; const pct = agreed ? Math.max(0, Math.min(100, Math.round((paid / agreed) * 100))) : 0;
  const daysLeft = m.nextEventAt ? Math.max(0, Math.ceil((Date.parse(m.nextEventAt) - loadedAt) / 86400000)) : undefined;
  const docs = workflow.documents;
  const timeline: TimelineItem[] = [
    { id: 'open', time: slash(m.openedAt), title: 'فتح ملف القضية', subtitle: `تم تسجيل القضية لدى ${m.authority || 'المكتب'}`, icon: 'document-text-outline', pill: 'مكتمل', tone: 'gold' },
    ...workflow.activity.slice().reverse().map((a, i): TimelineItem => ({ id: `activity${i}`, time: slash(a.date), title: a.title, icon: 'document-attach-outline', pill: 'مكتمل', tone: 'green' })),
    ...(m.currentStage ? [{ id: 'stage', time: 'حالياً', title: 'المرحلة الحالية', subtitle: m.currentStage, icon: 'people-outline', pill: 'قيد التنفيذ', tone: 'blue' } as TimelineItem] : []),
    ...(m.nextEventAt ? [{ id: 'next', time: slash(m.nextEventAt), date: clock.format(new Date(m.nextEventAt)), title: 'الجلسة القادمة', subtitle: m.authority, icon: 'calendar-outline', pill: 'مجدول', tone: 'red' } as TimelineItem] : []),
    ...(m.status === 'CLOSED' ? [{ id: 'closed', time: '—', title: 'إغلاق الملف', icon: 'checkmark-done-outline', pill: 'مغلق', tone: 'grey' } as TimelineItem] : []),
  ];
  const openClient = () => clientId && router.push({ pathname: '/clients/[id]', params: { id: clientId } });
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 115 }}>
      <HeroBackdrop style={{ paddingTop: insets.top + 12 }}>
        <View style={styles.heroInner}>
          <View style={[styles.nav, { flexDirection: row }]}>
            <RoundIconButton icon="chevron-forward" label="رجوع" bordered onPress={back}/>
            <Text style={styles.navTitle}>تفاصيل القضية</Text>
            <RoundIconButton icon="create-outline" label="تعديل بيانات القضية" onPress={edit}/>
          </View>
          <View style={[styles.headline, { flexDirection: row }]}>
            <View style={styles.docTile}><LinearGradient colors={['#1C3358', '#0B1A30']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}/><Ionicons name="document-text-outline" size={34} color={colors.gold500}/></View>
            <View style={styles.flex1}><Text numberOfLines={2} style={styles.caseTitle}>{m.title} - {matterTypes[m.type]}</Text><Text style={styles.caseRef}>رقم القضية {m.reference}</Text></View>
            <View style={styles.heroPill}><Pill {...badge}/></View>
          </View>
        </View>
        <View style={{ height: 40 }}/>
      </HeroBackdrop>
      <View style={styles.sheet}>
        <Button label="إدارة مسار القضية" onPress={() => router.push({ pathname: '/matters/[id]/workflow', params: { id } })}/>
        {m.status !== 'ARCHIVED' ? <Button label="تعديل بيانات القضية" variant="secondary" onPress={edit}/> : null}
        {m.status === 'CLOSED' ? (archiving
          ? <LuxeCard><Text style={styles.body}>الأرشفة تخفي القضية من القوائم النشطة وتحتفظ بكل بياناتها، ويمكن استعادتها لاحقاً.</Text><Button disabled={op.busy} label="تأكيد أرشفة القضية" onPress={() => void op.run(async () => { await matterRepository.setStatus(id, 'ARCHIVED'); setArchiving(false); }, 'تمت أرشفة القضية')}/><Button label="إلغاء" variant="secondary" onPress={() => setArchiving(false)}/></LuxeCard>
          : <Button label="أرشفة القضية" variant="secondary" onPress={() => setArchiving(true)}/>) : null}
        {m.status === 'ARCHIVED' ? <Button disabled={op.busy} label="استعادة القضية من الأرشيف" variant="secondary" onPress={() => void op.run(() => matterRepository.setStatus(id, 'CLOSED'), 'تمت استعادة القضية كقضية مغلقة')}/> : null}
        {op.error || op.message ? <Text accessibilityLiveRegion="polite" style={[styles.body, op.error ? styles.error : null]}>{op.error || op.message}</Text> : null}
        <LuxeCard>
          <View style={[styles.overview, { flexDirection: row }]}>
            <View style={styles.flex1}>
              <View style={[styles.tileHead, { flexDirection: row }]}><Ionicons name="reader-outline" size={22} color={colors.gold600}/><Text style={styles.tileTitle}>نظرة عامة</Text></View>
              <Text style={styles.body}>{m.notes || 'لا يوجد وصف مسجل لهذه القضية.'}</Text>
            </View>
            <View style={styles.facts}>
              <View style={[styles.fact, { flexDirection: row }]}><View style={styles.flex1}><Text style={styles.factLabel}>نوع القضية</Text><Text style={styles.factValue}>{matterTypes[m.type]}</Text></View><IconBubble icon="scale-balance" mc size={28}/></View>
              <View style={[styles.fact, styles.factDivider, { flexDirection: row }]}><View style={styles.flex1}><Text style={styles.factLabel}>تاريخ فتح القضية</Text><Text style={styles.factValue}>{slash(m.openedAt)}</Text></View><IconBubble icon="calendar-outline" size={28}/></View>
            </View>
          </View>
        </LuxeCard>
        <View style={[styles.grid, { flexDirection: row }]}>
          <Tile icon="people" title="بيانات العميل" action="عرض الملف" onAction={openClient}><Party name={client?.displayName ?? 'غير محدد'} role="العميل الأساسي"/></Tile>
          <Tile icon="people-outline" title="الخصم"><Party name={opponent?.displayName ?? 'غير مسجل بعد'} role="الجهة المدعى عليها"/></Tile>
          <Tile icon="bank" mc title="معلومات المحكمة" action="عرض التفاصيل" onAction={() => Alert.alert('معلومات المحكمة', m.authority || 'الجهة غير مسجلة')}><View style={[styles.party, { flexDirection: row }]}><View style={styles.flex1}><Text numberOfLines={2} style={styles.partyName}>{m.authority || 'غير مسجلة'}</Text><Text style={styles.partyRole}>{matterTypes[m.type]}</Text></View><MaterialCommunityIcons name="bank" size={30} color={colors.gold600}/></View></Tile>
          <Tile icon="person" title="المحامي المسؤول"><Party name={m.assignedLawyerName ? `أ. ${m.assignedLawyerName}` : 'غير مُسند بعد'} role="المحامي المسؤول" avatar/></Tile>
          <Tile icon="document-text" title="المستندات">
            <View style={[styles.docs, { flexDirection: row }]}>
              <View style={[styles.fileIcons, { flexDirection: row }]}>
                {[['file-pdf-box', '#E0463D'], ['file-word-box', '#2B64D9'], ['file-pdf-box', '#E0463D']].slice(0, Math.max(1, docs.length)).map(([n, c], i) => <View key={i} style={styles.fileIcon}><MaterialCommunityIcons name={n as never} size={30} color={c}/></View>)}
              </View>
              <View style={styles.docCount}><Text style={styles.bigNumber}>{docs.length}</Text><Text style={styles.partyRole}>مستندات مرفقة</Text></View>
            </View>
          </Tile>
          <Tile icon="create-outline" title="الملاحظات القانونية"><Text numberOfLines={3} style={styles.body}>{m.currentStage ?? 'لا توجد ملاحظات قانونية مسجلة بعد.'}</Text></Tile>
          <Tile icon="cash-multiple" mc title="الدفعات">
            <Text style={styles.amount}>{money(paid)}</Text>
            <Text style={styles.partyRole}>من أصل {money(agreed)}</Text>
            <View style={[styles.progressRow, { flexDirection: row }]}><View style={styles.track}><LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${pct}%` }]}/></View><Text style={styles.pct}>{pct}%</Text></View>
          </Tile>
          <Tile icon="calendar-outline" title="المواعيد المهمة">
            {m.nextEventAt ? <View style={[styles.party, { flexDirection: row }]}><View style={[styles.dot, { backgroundColor: colors.info }]}/><Text style={[styles.partyRole, styles.flex1]}>الجلسة القادمة</Text><View><Text style={styles.factValue}>{slash(m.nextEventAt)}</Text><Text style={styles.partyRole}>بعد {daysLeft} يوم</Text></View></View> : <Text style={styles.body}>لا يوجد موعد قادم مسجل.</Text>}
          </Tile>
        </View>
        <LuxeCard>
          <SectionTitle icon="time-outline" title="تسلسل القضية"/>
          <Timeline items={timeline}/>
        </LuxeCard>
        <Text style={styles.disclaimer}>بيانات القضية وأطرافها من خادم المكتب. المستندات والأتعاب والمواعيد والملاحظات من هذا الجهاز فقط ولا تتم مزامنتها بعد.</Text>
      </View>
    </ScrollView>
    <BottomNavigation selected="matters" onNavigate={(name) => router.replace(name === 'index' ? '/(tabs)' : `/(tabs)/${name}`)}/>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  flex1: { flex: 1 },
  heroInner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: 20, gap: 22 },
  nav: { alignItems: 'center', justifyContent: 'space-between' },
  navTitle: { color: colors.white, fontFamily: typography.black, fontSize: 24 },
  headline: { alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  docTile: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.gold500 },
  caseTitle: { ...rtl, color: colors.white, fontFamily: typography.black, fontSize: 22, lineHeight: 32 },
  caseRef: { ...rtl, color: '#E3E7EE', fontFamily: typography.medium, fontSize: 14 },
  heroPill: { width: '100%', alignItems: 'flex-end' },
  sheet: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: 12, marginTop: -26, gap: 12 },
  overview: { gap: 12 },
  facts: { width: 125, gap: 8 },
  fact: { alignItems: 'center', gap: 8 },
  factDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  factLabel: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  factValue: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 14 },
  body: { ...rtl, color: '#4E5767', fontFamily: typography.regular, fontSize: 13, lineHeight: 22 },
  grid: { flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 118, paddingHorizontal: 10 },
  tileHead: { alignItems: 'center', gap: 8, marginBottom: 4 },
  tileTitle: { flexShrink: 1, ...rtl, color: colors.navy950, fontFamily: typography.black, fontSize: 14 },
  tileAction: { alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginTop: 'auto', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tileActionText: { color: colors.navy950, fontFamily: typography.bold, fontSize: 13 },
  party: { alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  partyName: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 13, lineHeight: 19 },
  partyRole: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
  docs: { alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  fileIcons: { gap: 6 },
  fileIcon: { width: 30, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  docCount: { alignItems: 'center' },
  bigNumber: { color: colors.navy950, fontFamily: typography.black, fontSize: 32, lineHeight: 40 },
  amount: { ...rtl, color: colors.navy950, fontFamily: typography.black, fontSize: 20 },
  progressRow: { alignItems: 'center', gap: 8, marginTop: 6 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#EDE6D8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  pct: { color: colors.gold700, fontFamily: typography.bold, fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  disclaimer: { ...rtl, textAlign: 'center', color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  error: { color: colors.danger },
});



