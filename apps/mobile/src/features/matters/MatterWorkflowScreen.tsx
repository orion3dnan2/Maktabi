import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { BodyText, Button, Card, ChoiceField, ErrorState, FormPage, Input, LoadingState, SectionHeader, featureStyles as s } from '@maktabi/ui';
import { matterRepository, workflowRepository } from '@/data/repositories';
import { appointmentISO, paidTotal, workflowStages } from '@/data/workflow';
import { money, useResource } from '../shared/hooks';
import { downloadAttachment, pickAttachment } from './workflowFiles';
import { ProcedurePanel } from './ProcedurePanel';
import { FinancePanel } from './FinancePanel';

const sections = [ { value: 'procedure', label: 'مسار الإجراءات' }, { value: 'appointments', label: 'المواعيد' }, { value: 'documents', label: 'المستندات' }, { value: 'finance', label: 'الأتعاب والإيصالات' }, { value: 'notes', label: 'المتابعة والإغلاق' } ];
const localDate = (iso: string) => new Date(iso).toLocaleString('ar', { numberingSystem: 'latn' });
export default function MatterWorkflowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const load = useCallback(async () => { const [matter, workflow] = await Promise.all([matterRepository.getById(id), workflowRepository.getByMatter(id)]); if (!matter) throw new Error('القضية غير موجودة'); return { matter, workflow }; }, [id]);
  const { data, error, reload } = useResource(load);
  const [section, setSection] = useState('appointments');
  const [title, setTitle] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState('09:30');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [message, setMessage] = useState(''); const [failure, setFailure] = useState(''); const [closing, setClosing] = useState(false);
  const run = async (action: () => Promise<void>, success: string) => {
    if (lock.current) return; lock.current = true; setBusy(true); setFailure(''); setMessage('');
    try { await action(); setMessage(success); reload(); } catch (e) { setFailure(e instanceof Error ? e.message : 'تعذر حفظ العملية؛ حاول مرة أخرى'); } finally { lock.current = false; setBusy(false); }
  };
  if (error) return <FormPage title="سير القضية"><ErrorState message={error} onRetry={reload}/></FormPage>;
  if (!data) return <LoadingState/>;
  const { matter: m, workflow: w } = data; const paid = paidTotal(w); const closed = m.status === 'CLOSED' || m.status === 'ARCHIVED';
  const stages = workflowStages(w); const client = m.parties.find((p) => p.isPrimary);
  return <FormPage title="مسار العميل والقضية">
    <Button label="تفاصيل القضية" variant="secondary" onPress={() => router.replace({ pathname: '/matters/[id]', params: { id } })}/>
    <Card><Text style={s.title}>{m.reference} · {m.title}</Text><BodyText>العميل: {client?.displayName}</BodyText><BodyText>{closed ? 'القضية مغلقة' : `${stages.filter((s) => s.done).length} / ${stages.length} مراحل مسجلة`}</BodyText>
      <BodyText>✓ تسجيل العميل · ✓ إنشاء القضية</BodyText>{stages.map((stage) => <BodyText key={stage.label}>{stage.done ? '✓' : '○'} {stage.label}</BodyText>)}
      <BodyText muted>تُحفظ العمليات والمرفقات محلياً على هذا الجهاز.</BodyText>
    </Card>
    <ChoiceField label="مرحلة العمل" value={section} options={sections} onChange={(value) => { setSection(value); setMessage(''); setFailure(''); }}/>
    {failure ? <Text accessibilityRole="alert" style={s.error}>{failure}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={s.text}>{message}</Text> : null}
    {section === 'procedure' ? <ProcedurePanel matter={m} workflow={w} run={run} busy={busy} closed={closed}/> : null}
    {section === 'appointments' ? <Card><SectionHeader title="المواعيد والجلسات"/>
      {!closed ? <><Input label="عنوان الموعد" value={title} onChangeText={setTitle}/><Input label="تاريخ الموعد (YYYY-MM-DD)" placeholder="2026-10-05" value={date} onChangeText={setDate}/><Input label="وقت الموعد (HH:mm)" value={time} onChangeText={setTime}/><BodyText muted>الوقت حسب المنطقة الزمنية للجهاز.</BodyText><Button disabled={busy} label="حفظ الموعد" onPress={() => void run(async () => { await workflowRepository.addAppointment(id, { title, startsAt: appointmentISO(date, time) }); setTitle(''); setDate(''); }, 'تم حفظ الموعد وإضافته إلى التقويم')}/></> : null}
      {!w.appointments.length ? <BodyText muted>لا توجد مواعيد مسجلة.</BodyText> : w.appointments.map((a) => <View key={a.id} style={s.item}><BodyText>{a.title} · {localDate(a.startsAt)}</BodyText><BodyText>{a.status === 'COMPLETED' ? 'مكتمل' : a.status === 'CANCELLED' ? 'ملغي' : 'مجدول'}</BodyText>{!closed && a.status === 'SCHEDULED' ? <View style={s.row}><Button disabled={busy} label={`إتمام: ${a.title}`} onPress={() => void run(() => workflowRepository.setAppointmentStatus(id, a.id, 'COMPLETED'), 'تم إتمام الموعد')}/><Button disabled={busy} label={`إلغاء: ${a.title}`} variant="secondary" onPress={() => void run(() => workflowRepository.setAppointmentStatus(id, a.id, 'CANCELLED'), 'تم إلغاء الموعد')}/></View> : null}</View>)}
    </Card> : null}
    {section === 'documents' ? <Card><SectionHeader title="المستندات المرفقة"/><BodyText muted>PDF أو Word أو صورة أو نص، حتى 1 ميجابايت لكل مستند.</BodyText>
      {!closed ? <Button label="إرفاق مستند" disabled={busy} onPress={() => void run(async () => { const doc = await pickAttachment(); if (doc) await workflowRepository.addDocument(id, doc); }, 'تم تحديث المستندات')}/> : null}
      {!w.documents.length ? <BodyText muted>لا توجد مرفقات بعد.</BodyText> : w.documents.map((doc) => <View key={doc.id} style={s.item}><BodyText>{doc.title}</BodyText><BodyText muted>{localDate(doc.date)}</BodyText><Button disabled={busy} label={`تنزيل: ${doc.name}`} variant="secondary" onPress={() => void run(() => downloadAttachment(doc), 'المستند جاهز')}/></View>)}
    </Card> : null}
    {section === 'finance' ? <FinancePanel matter={m} workflow={w} run={run} busy={busy} closed={closed}/> : null}
    {section === 'notes' ? <><Card><SectionHeader title="ملاحظات المتابعة"/>{!closed ? <><Input label="ملاحظة المتابعة" multiline value={note} onChangeText={setNote}/><Button disabled={busy} label="حفظ الملاحظة" onPress={() => void run(async () => { await workflowRepository.addNote(id, note); setNote(''); }, 'تم حفظ الملاحظة')}/></> : null}{w.notes.map((n) => <View key={n.id} style={s.item}><BodyText>{n.text}</BodyText><BodyText muted>{localDate(n.date)}</BodyText></View>)}</Card>
      <Card><SectionHeader title="سجل العمليات"/>{w.activity.map((a, i) => <BodyText key={`${a.date}-${i}`}>{a.title} · {localDate(a.date)}</BodyText>)}</Card>
      {!closed ? <Card><BodyText>المتبقي من الأتعاب: {money(w.agreedFees - paid)}</BodyText><BodyText muted>الإغلاق يحتفظ بالملف والمستندات والإيصالات ويوقف إضافة عمليات جديدة.</BodyText>{closing ? <><BodyText>تأكيد إغلاق هذه القضية؟</BodyText><Button disabled={busy} label="تأكيد إغلاق القضية" onPress={() => void run(async () => { await workflowRepository.closeMatter(id); setClosing(false); }, 'تم إغلاق القضية وحفظ سجلها')}/><Button label="متابعة العمل" variant="secondary" onPress={() => setClosing(false)}/></> : <Button label="إغلاق القضية" variant="secondary" onPress={() => setClosing(true)}/>}</Card> : null}
    </> : null}
    {client?.clientId ? <Button label="ملف العميل" variant="secondary" onPress={() => router.push({ pathname: '/clients/[id]', params: { id: client.clientId! } })}/> : null}
  </FormPage>;
}

