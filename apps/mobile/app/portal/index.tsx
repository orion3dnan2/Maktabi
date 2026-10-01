import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyText, ErrorState, LoadingState, colors, typography } from '@maktabi/ui';
import { HeroHeader, LuxeCard, Pill, row, rtl, SectionTitle, Sheet, type Tone } from '@/components/luxe';
import { supabase } from '@/lib/supabase';
import { AccountCard } from '@/features/auth/AccountCard';
import { useResource } from '@/features/shared/hooks';
import { currencyLabel, formatDayMonth, formatTime } from '@/lib/format';

interface PortalMatter { id: string; matter_number: string; title: string; matter_type: string; status: 'open' | 'on_hold' | 'closed' | 'archived'; court_name: string | null; case_number: string | null; lawyer_name: string | null }
interface PortalAppointment { id: string; title: string; appointment_type: string; starts_at: string; location: string | null; matter_title: string | null }
interface PortalPayment { id: string; amount: number; currency: string; payment_status: 'pending' | 'completed' | 'refunded'; paid_at: string | null; reference_number: string | null; matter_number: string | null }
interface PortalData { client: { full_name: string } | null; office: { name: string; phone: string | null; address: string | null } | null; matters: PortalMatter[]; appointments: PortalAppointment[]; payments: PortalPayment[] }

const matterStatus: Record<PortalMatter['status'], [string, Tone]> = { open: ['جارية', 'green'], on_hold: ['معلّقة', 'gold'], closed: ['منتهية', 'grey'], archived: ['مؤرشفة', 'grey'] };
const appointmentType: Record<string, string> = { court_session: 'جلسة محكمة', client_meeting: 'موعد مع المكتب', consultation: 'استشارة' };
const paymentStatus: Record<PortalPayment['payment_status'], [string, Tone]> = { completed: ['مدفوعة', 'green'], pending: ['قيد الانتظار', 'gold'], refunded: ['مستردة', 'blue'] };

/** Client portal: read-only view of the client's own matters, upcoming sessions and payments. */
export default function PortalScreen() {
  const portal = useResource(useCallback(async () => {
    const { data, error } = await supabase.rpc('portal_overview');
    if (error) throw error;
    return data as unknown as PortalData;
  }, []));
  const d = portal.data;
  return <View style={styles.page}><ScrollView refreshControl={<RefreshControl refreshing={portal.loading && !!d} onRefresh={portal.reload}/>}>
    <HeroHeader title={d?.client?.full_name ? `مرحباً ${d.client.full_name}` : 'بوابة الموكل'} subtitle={d?.office?.name ?? 'مكتب المحامي'}/>
    <Sheet>
      {portal.loading && !d ? <LoadingState/> : portal.error ? <ErrorState message={portal.error} onRetry={portal.reload}/> : d ? <>
        <LuxeCard>
          <SectionTitle icon="briefcase-outline" title="قضاياي"/>
          {d.matters.length ? d.matters.map((m) => <View key={m.id} style={styles.item}>
            <View style={[styles.head, { flexDirection: row }]}><Text style={styles.title}>{m.title}</Text><Pill label={matterStatus[m.status][0]} tone={matterStatus[m.status][1]}/></View>
            <Text style={styles.meta}>رقم الملف: {m.matter_number}{m.case_number ? ` · رقم الدعوى: ${m.case_number}` : ''}</Text>
            {m.court_name ? <Text style={styles.meta}>المحكمة: {m.court_name}</Text> : null}
            {m.lawyer_name ? <Text style={styles.meta}>المحامي المسؤول: {m.lawyer_name}</Text> : null}
          </View>) : <BodyText muted>لا توجد قضايا مسجلة باسمك حتى الآن.</BodyText>}
        </LuxeCard>
        <LuxeCard>
          <SectionTitle icon="calendar-outline" title="المواعيد والجلسات القادمة"/>
          {d.appointments.length ? d.appointments.map((a) => <View key={a.id} style={styles.item}>
            <Text style={styles.title}>{a.title}</Text>
            <Text style={styles.meta}>{appointmentType[a.appointment_type] ?? 'موعد'} · {formatDayMonth(a.starts_at)} · {formatTime(a.starts_at)}</Text>
            {a.location ? <Text style={styles.meta}>المكان: {a.location}</Text> : null}
            {a.matter_title ? <Text style={styles.meta}>القضية: {a.matter_title}</Text> : null}
          </View>) : <BodyText muted>لا توجد مواعيد قادمة.</BodyText>}
        </LuxeCard>
        <LuxeCard>
          <SectionTitle icon="wallet-outline" title="المدفوعات"/>
          {d.payments.length ? d.payments.map((p) => <View key={p.id} style={styles.item}>
            <View style={[styles.head, { flexDirection: row }]}><Text style={styles.title}>{Number(p.amount).toLocaleString('ar-SD-u-nu-latn')} {currencyLabel(p.currency)}</Text><Pill label={paymentStatus[p.payment_status][0]} tone={paymentStatus[p.payment_status][1]}/></View>
            <Text style={styles.meta}>{[p.paid_at ? formatDayMonth(p.paid_at) : null, p.matter_number ? `الملف ${p.matter_number}` : null, p.reference_number ? `مرجع ${p.reference_number}` : null].filter(Boolean).join(' · ')}</Text>
          </View>) : <BodyText muted>لا توجد مدفوعات مسجلة.</BodyText>}
        </LuxeCard>
        {d.office?.phone || d.office?.address ? <LuxeCard>
          <SectionTitle icon="call-outline" title="تواصل مع المكتب"/>
          {d.office.phone ? <Text style={[styles.meta, { writingDirection: 'ltr', textAlign: 'right' }]}>{d.office.phone}</Text> : null}
          {d.office.address ? <Text style={styles.meta}>{d.office.address}</Text> : null}
        </LuxeCard> : null}
      </> : null}
      <AccountCard/>
    </Sheet>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  item: { gap: 4, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { ...rtl, flex: 1, color: colors.navy950, fontFamily: typography.bold, fontSize: 16, lineHeight: 26 },
  meta: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 14, lineHeight: 22 },
});
