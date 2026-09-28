import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { matterTypes, type MatterType } from '@maktabi/domain';
import { BodyText, Button, Card, ChoiceField, FormPage, Input, SectionHeader, choices, featureStyles as s } from '@maktabi/ui';
import { newId, officeRepository } from '@/data/repositories';
import type { ProcedureTemplate } from '@/data/office';
import { useResource } from '@/features/shared/hooks';
import { useOperation } from '@/features/shared/useOperation';
export default function ProcedureTemplatesScreen() {
  const router = useRouter(); const resource = useResource(useCallback(() => officeRepository.listTemplates(), [])); const op = useOperation(resource.reload);
  const [name, setName] = useState(''); const [type, setType] = useState<MatterType>('CIVIL'); const [stages, setStages] = useState<ProcedureTemplate['stages']>([]);
  const [stageName, setStageName] = useState(''); const [authority, setAuthority] = useState(''); const [requirements, setRequirements] = useState('');
  return <FormPage title="قوالب إجراءات المكتب"><Button label="العودة للمزيد" variant="secondary" onPress={() => router.replace('/(tabs)/more')}/>
    <Card><SectionHeader title="قالب جديد أو نسخة مخصصة"/><Input label="اسم القالب" value={name} onChangeText={setName}/><ChoiceField label="نوع الملف" value={type} onChange={(v) => setType(v as MatterType)} options={choices(matterTypes)}/>
      {stages.map((stage, i) => <View key={i} style={s.item}><BodyText>{i + 1}. {stage.name} · {stage.authority}</BodyText><Button label={`إزالة المرحلة ${i + 1} من القالب`} variant="secondary" onPress={() => setStages((list) => list.filter((_, index) => i !== index))}/></View>)}
      <Input label="اسم المرحلة الجديدة" value={stageName} onChangeText={setStageName}/><Input label="الجهة المسؤولة" value={authority} onChangeText={setAuthority}/><Input label="المستندات المطلوبة، كل مستند في سطر" multiline value={requirements} onChangeText={setRequirements}/><Button label="إضافة المرحلة إلى القالب" disabled={!stageName.trim() || !authority.trim()} variant="secondary" onPress={() => { setStages((list) => [...list, { name: stageName.trim(), authority: authority.trim(), requirements: requirements.split('\n').map((r) => r.trim()).filter(Boolean) }]); setStageName(''); setRequirements(''); }}/>
      <Button label="حفظ قالب المكتب" disabled={op.busy} onPress={() => void op.run(async () => { await officeRepository.saveTemplate({ id: newId(), name, types: [type], stages }); setName(''); setStages([]); })}/></Card>
    {op.message || op.error || resource.error ? <Text accessibilityLiveRegion="polite" style={s.text}>{op.error || resource.error || op.message}</Text> : null}
    {(resource.data ?? []).map((t) => <Card key={t.id}><SectionHeader title={t.name}/><BodyText muted>{t.stages.map((s) => s.name).join(' ← ')}</BodyText><Button label={`تخصيص: ${t.name}`} variant="secondary" onPress={() => { setName(`${t.name} — مخصص`); setType(t.types[0]!); setStages(t.stages.map((s) => ({ ...s, requirements: [...s.requirements] }))); }}/></Card>)}
  </FormPage>;
}
