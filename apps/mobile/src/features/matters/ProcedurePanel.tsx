import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { Matter } from '@maktabi/domain';
import { BodyText, Button, Card, ChoiceField, Input, SectionHeader, featureStyles as s } from '@maktabi/ui';
import { officeRepository } from '@/data/repositories';
import { procedureFields, type ProcedureStage } from '@/data/office';
import { appointmentISO, type MatterWorkflow } from '@/data/workflow';
import { useResource } from '../shared/hooks';
import { ServiceNotice } from '@/components/ServiceNotice';

export type RunOperation = (action: () => Promise<void>, success: string) => Promise<void>;
const labels = { PENDING: 'لم تبدأ', ACTIVE: 'جارية', COMPLETED: 'مكتملة', SKIPPED: 'متجاوزة' };
export function ProcedurePanel({ matter, workflow, run, busy, closed }: { matter: Matter; workflow: MatterWorkflow; run: RunOperation; busy: boolean; closed: boolean }) {
  const templates = useResource(useCallback(() => officeRepository.listTemplates(), []));
  const [templateId, setTemplateId] = useState(''); const [selected, setSelected] = useState('');
  const [deadlineTitle, setDeadlineTitle] = useState(''); const [deadlineDate, setDeadlineDate] = useState(''); const [source, setSource] = useState('');
  const stage = workflow.stages.find((s) => s.id === selected);
  return <><Card><SectionHeader title="مسار الإجراءات"/><BodyText muted>اختر المسار المناسب للمعاملة. يمكن تجاوز مرحلة غير لازمة مع تسجيل السبب.</BodyText>
    {!closed && !workflow.stages.some((s) => s.status === 'PENDING' || s.status === 'ACTIVE') ? <><ChoiceField label="قالب المسار" value={templateId} onChange={setTemplateId} options={(templates.data ?? []).filter((t) => t.types.includes(matter.type)).map((t) => ({ value: t.id, label: t.name }))}/><Button disabled={busy || !templateId} label="إضافة مراحل المسار" onPress={() => void run(() => officeRepository.appendProcedure(matter.id, templateId), 'تمت إضافة المراحل')}/></> : null}
    {workflow.stages.map((s, i) => <Button key={s.id} variant="secondary" label={`${i + 1}. ${s.name} · ${labels[s.status]}`} onPress={() => setSelected(s.id)}/>)}
    {!workflow.stages.length ? <BodyText muted>اختر قالباً لإضافة المراحل ثم افتح المرحلة الأولى.</BodyText> : null}
    </Card>{stage ? <StageEditor key={`${stage.id}-${workflow.activity.length}`} matterId={matter.id} initial={stage} workflow={workflow} run={run} busy={busy} closed={closed}/> : null}
    <Card><SectionHeader title="مواعيد الطعن والمهل المستقلة"/>{!closed ? <><Input label="عنوان المهلة" value={deadlineTitle} onChangeText={setDeadlineTitle}/><Input label="آخر يوم حسب مراجعة المحامي (YYYY-MM-DD)" value={deadlineDate} onChangeText={setDeadlineDate}/><Input label="المصدر القانوني وطريقة حساب المهلة" value={source} onChangeText={setSource} multiline/><Button disabled={busy} label="حفظ المهلة المعتمدة" onPress={() => void run(async () => { await officeRepository.addDeadline(matter.id, { title: deadlineTitle, dueAt: appointmentISO(deadlineDate, '23:59'), source }); setDeadlineTitle(''); setDeadlineDate(''); setSource(''); }, 'تمت إضافة المهلة')}/></> : null}
      {workflow.deadlines.map((d) => <View key={d.id} style={s.item}><BodyText>{d.title} · {new Date(d.dueAt).toLocaleDateString('ar-SD')} · {d.completed ? 'مكتمل' : new Date(d.dueAt) < new Date() ? 'متأخر' : 'قادم'}</BodyText><BodyText muted>{d.source}</BodyText>{!closed && !d.completed ? <Button variant="secondary" disabled={busy} label={`إتمام المهلة: ${d.title}`} onPress={() => void run(() => officeRepository.completeDeadline(matter.id, d.id), 'تم إتمام المهلة')}/> : null}</View>)}
    </Card><ServiceNotice service="legalRules"/></>;
}
function StageEditor({ matterId, initial, workflow, run, busy, closed }: { matterId: string; initial: ProcedureStage; workflow: MatterWorkflow; run: RunOperation; busy: boolean; closed: boolean }) {
  const [stage, setStage] = useState(initial); const [nextDate, setNextDate] = useState(initial.nextAt ? new Date(initial.nextAt).toLocaleDateString('en-CA') : ''); const [nextTime, setNextTime] = useState(initial.nextAt ? new Date(initial.nextAt).toTimeString().slice(0, 5) : '09:00'); const [reason, setReason] = useState('');
  const set = (key: keyof ProcedureStage, value: string) => setStage((s) => ({ ...s, [key]: value }));
  const fields = procedureFields[initial.authority] ?? procedureFields['المحكمة']!;
  const finished = initial.status === 'COMPLETED' || initial.status === 'SKIPPED';
  return <Card><SectionHeader title={`${initial.name} · ${labels[initial.status]}`}/>
    <Input label="اسم المرحلة" value={stage.name} onChangeText={(v) => set('name', v)} editable={!closed && !finished}/><Input label="الجهة" value={stage.authority} onChangeText={(v) => set('authority', v)} editable={!closed && !finished}/><Input label="رقم الملف لدى هذه الجهة" value={stage.reference} onChangeText={(v) => set('reference', v)} editable={!closed && !finished}/><Input label="تاريخ المرحلة (YYYY-MM-DD)" value={stage.date} onChangeText={(v) => set('date', v)} editable={!closed && !finished}/>
    {Object.entries(fields).map(([key, label]) => <Input key={key} label={label} value={stage.details[key] ?? ''} onChangeText={(v) => setStage((s) => ({ ...s, details: { ...s.details, [key]: v } }))} editable={!closed && !finished}/>)}
    <Input label="ملاحظات المرحلة" multiline value={stage.notes} onChangeText={(v) => set('notes', v)} editable={!closed && !finished}/><SectionHeader title="متطلبات المرحلة"/>
    {stage.requirements.map((r, i) => <Button key={i} variant="secondary" disabled={closed || finished} label={`${r.done ? '✓' : '○'} ${r.title}`} onPress={() => setStage((s) => ({ ...s, requirements: s.requirements.map((v, index) => index === i ? { ...v, done: !v.done } : v) }))}/>)}
    <SectionHeader title="مستندات المرحلة"/>{workflow.documents.length ? workflow.documents.map((d) => <Button key={d.id} variant="secondary" disabled={closed || finished} label={`${stage.documentIds.includes(d.id) ? '✓' : '○'} ${d.title}`} onPress={() => setStage((s) => ({ ...s, documentIds: s.documentIds.includes(d.id) ? s.documentIds.filter((id) => id !== d.id) : [...s.documentIds, d.id] }))}/>) : <BodyText muted>أرفق المستندات من قسم المستندات ثم اربطها هنا.</BodyText>}
    {!closed && !finished ? <><Input label="الموعد التالي للمرحلة (YYYY-MM-DD، اختياري)" value={nextDate} onChangeText={setNextDate}/><Input label="وقت الموعد التالي" value={nextTime} onChangeText={setNextTime}/><Button disabled={busy} label="حفظ بيانات المرحلة" onPress={() => void run(() => officeRepository.saveStage(matterId, { ...stage, nextAt: nextDate ? appointmentISO(nextDate, nextTime) : undefined }), 'تم حفظ المرحلة وربط موعدها بالتقويم')}/>
      {initial.status === 'PENDING' ? <Button disabled={busy} label="بدء المرحلة" onPress={() => void run(() => officeRepository.transitionStage(matterId, stage.id, 'ACTIVE'), 'بدأت المرحلة')}/> : <Button disabled={busy} label="إكمال المرحلة" onPress={() => void run(() => officeRepository.transitionStage(matterId, stage.id, 'COMPLETED'), 'اكتملت المرحلة')}/>}
      <Input label="سبب تجاوز المرحلة" value={reason} onChangeText={setReason}/><Button disabled={busy || !reason.trim()} label="تجاوز المرحلة مع حفظ السبب" variant="secondary" onPress={() => void run(() => officeRepository.transitionStage(matterId, stage.id, 'SKIPPED', reason), 'تم تجاوز المرحلة وحفظ السبب')}/></> : <BodyText muted>هذه المرحلة محفوظة في سجل الملف.</BodyText>}
  </Card>;
}
