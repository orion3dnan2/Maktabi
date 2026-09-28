import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { BodyText, Button, Card, FormPage, Input, SectionHeader, featureStyles } from '@maktabi/ui';
import { defaultOffice } from '@/data/office';
import { officeRepository } from '@/data/repositories';
import { useResource } from '@/features/shared/hooks';
import { useOperation } from '@/features/shared/useOperation';
import { pickAttachment } from '@/features/matters/workflowFiles';
import { ServiceNotice } from '@/components/ServiceNotice';
export default function OfficeSettingsScreen() {
  const router = useRouter(); const resource = useResource(useCallback(() => officeRepository.getSettings(), []));
  const [settings, setSettings] = useState(defaultOffice().settings); const op = useOperation();
  useEffect(() => { if (resource.data) setSettings(resource.data); }, [resource.data]);
  return <FormPage title="إعدادات المكتب"><Button label="العودة للمزيد" variant="secondary" onPress={() => router.replace('/(tabs)/more')}/><Card><SectionHeader title="بيانات المكتب والإيصالات"/>
    {Object.entries({ name: 'اسم المكتب', address: 'العنوان', phone: 'هاتف المكتب', receiver: 'اسم مستلم الدفعات', receiptPrefix: 'بادئة الإيصالات (حروف لاتينية / أرقام)' }).map(([key, label]) => <Input key={key} label={label} value={settings[key as 'name']} onChangeText={(value) => setSettings((s) => ({ ...s, [key]: value }))}/>)}
    <BodyText muted>يُرقّم كل إيصال تلقائياً حسب السنة مع الاحتفاظ بأرقام الإيصالات الملغاة.</BodyText>
    <Button label={settings.logo ? `الشعار: ${settings.logo.name}` : 'إرفاق شعار المكتب'} variant="secondary" disabled={op.busy} onPress={() => void op.run(async () => { const logo = await pickAttachment(); if (logo) { if (!logo.mimeType.startsWith('image/')) throw new Error('اختر صورة للشعار'); setSettings((s) => ({ ...s, logo })); } }, 'أُرفق الشعار؛ احفظ الإعدادات')}/>
    <Button label={settings.seal ? `الختم: ${settings.seal.name}` : 'إرفاق الختم المعتمد'} variant="secondary" disabled={op.busy} onPress={() => void op.run(async () => { const seal = await pickAttachment(); if (seal) { if (!seal.mimeType.startsWith('image/')) throw new Error('اختر صورة للختم'); setSettings((s) => ({ ...s, seal })); } }, 'أُرفق الختم؛ احفظ الإعدادات')}/>
    <Button disabled={op.busy || !resource.data} label="حفظ إعدادات المكتب" onPress={() => void op.run(() => officeRepository.saveSettings(settings))}/></Card>
    {op.message || op.error || resource.error ? <Text accessibilityLiveRegion="polite" style={featureStyles.text}>{op.error || resource.error || op.message}</Text> : null}
    <ServiceNotice service="hosting"/>
  </FormPage>;
}
