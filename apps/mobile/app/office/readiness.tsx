import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { BodyText, Button, Card, ChoiceField, FormPage, Input, SectionHeader, featureStyles } from '@maktabi/ui';
import { officeRepository } from '@/data/repositories';
import { serviceRequirements, type ServiceKey } from '@/data/readiness';
import type { Attachment } from '@/data/workflow';
import { useResource } from '@/features/shared/hooks';
import { downloadAttachment, pickAttachment } from '@/features/matters/workflowFiles';
type Draft = { notes: string; links: string; documents: Attachment[] };

export default function ReadinessScreen() {
  const params = useLocalSearchParams<{ service?: ServiceKey }>(); const router = useRouter();
  const [service, setService] = useState<ServiceKey>(params.service && Object.hasOwn(serviceRequirements, params.service) ? params.service : 'hosting');
  const resource = useResource(useCallback(() => officeRepository.listReadiness(), []));
  const [drafts, setDrafts] = useState<Partial<Record<ServiceKey, Draft>>>({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const saved = resource.data?.find((s) => s.service === service);
  const draft = drafts[service] ?? { notes: saved?.notes ?? '', links: saved?.links ?? '', documents: saved?.documents ?? [] };
  const { notes, links, documents } = draft;
  const edit = (update: (value: Draft) => Draft) => setDrafts(current => ({ ...current, [service]: update(current[service] ?? draft) }));
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setMessage(''); try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setBusy(false); } };
  const item = serviceRequirements[service];
  return <FormPage title="متطلبات تفعيل مكتب المحامي"><Button label="العودة للمزيد" variant="secondary" onPress={() => router.replace('/(tabs)/more')}/>
    <BodyText>هذه المتطلبات تخص مكتب المحامي صاحب التطبيق. تجهيز المعلومات هنا لا يرسلها تلقائياً إلى أي جهة.</BodyText>
    <ChoiceField label="الخدمة" value={service} onChange={(v) => { setService(v as ServiceKey); setMessage(''); }} options={Object.entries(serviceRequirements).map(([value, r]) => ({ value, label: r.title }))}/>
    <Card><SectionHeader title={item.title}/><BodyText>{saved ? 'تم تجهيز البيانات محلياً · تحتاج تسليماً ومراجعة من فريق التنفيذ' : 'بانتظار بيانات المكتب'}</BodyText><BodyText>{item.benefit}</BodyText><SectionHeader title="المطلوب من المكتب"/><BodyText>{item.need}</BodyText><SectionHeader title="الخطوة التالية"/><BodyText>{item.next}</BodyText></Card>
    <Card><Input label="بيانات المكتب وملاحظاته" value={notes} onChangeText={notes => edit(value => ({ ...value, notes }))} multiline/><Input label="روابط المصادر أو الجهات" value={links} onChangeText={links => edit(value => ({ ...value, links }))} multiline/><BodyText muted>لا تكتب كلمات مرور أو مفاتيح وصول هنا. تُسلّم بيانات الوصول لفريق التنفيذ عبر قناة آمنة.</BodyText>
    <Button label="إرفاق مستند مطلوب" disabled={busy} variant="secondary" onPress={() => void run(async () => { const doc = await pickAttachment(); if (doc) edit(value => ({ ...value, documents: [...value.documents, doc] })); })}/>
    {documents.map((d) => <Button key={d.id} label={d.name} variant="secondary" onPress={() => void run(() => downloadAttachment(d))}/>)}
    <Button label="حفظ متطلبات المكتب" disabled={busy} onPress={() => void run(async () => { await officeRepository.submitReadiness({ service, notes, links, documents, submittedAt: '' }); resource.reload(); setMessage('تم حفظ البيانات محلياً؛ الخدمة لم تُفعّل بعد'); })}/></Card>
    {message || resource.error ? <Text accessibilityLiveRegion="polite" style={featureStyles.text}>{message || resource.error}</Text> : null}
  </FormPage>;
}
