import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { BodyText, Button, Card, FormPage, Input, SectionHeader, featureStyles } from '@maktabi/ui';
import { encryptedBackup, isUnlocked, restoreEncryptedBackup } from '@/data/vault';
import { base64 } from '@/data/encoding';
import { resetRepositories } from '@/data/repositories';
import { downloadAttachment } from '@/features/matters/workflowFiles';
import { useOperation } from '@/features/shared/useOperation';
export default function BackupScreen() {
  const router = useRouter(); const op = useOperation(); const [raw, setRaw] = useState(''); const [filename, setFilename] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [confirmed, setConfirmed] = useState(false);
  return <FormPage title="النسخ الاحتياطي المشفر"><Button label="رجوع" variant="secondary" onPress={() => router.replace(isUnlocked() ? '/(tabs)/more' : '/login')}/>
    <Card><SectionHeader title="نسخة كاملة من المكتب"/><BodyText>النسخة تحتوي على ملفات المكتب ومرفقاته مشفرة. تحتاج رقم الهاتف وكلمة المرور المستخدمة عند إنشاء النسخة لفتحها.</BodyText>{isUnlocked() ? <Button disabled={op.busy} label="تصدير النسخة المشفرة" onPress={() => void op.run(async () => { const text = await encryptedBackup(); await downloadAttachment({ id: 'office-backup', title: 'نسخة المكتب', name: `maktabi-backup-${new Date().toISOString().slice(0, 10)}.json`, date: new Date().toISOString(), mimeType: 'application/json', dataUri: `data:application/json;base64,${base64(new TextEncoder().encode(text))}` }); }, 'تم تجهيز النسخة للمشاركة أو التنزيل')}/> : null}</Card>
    <Card><SectionHeader title="استعادة نسخة"/><Button disabled={op.busy} label="اختيار نسخة احتياطية" variant="secondary" onPress={() => void op.run(async () => { const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true }); if (result.canceled) return; const asset = result.assets[0]!; if ((asset.size ?? 0) > 50 * 1024 * 1024) throw new Error('النسخة أكبر من الحد المسموح 50 ميجابايت'); const value = Platform.OS === 'web' ? await asset.file!.text() : await new File(asset.uri).text(); setRaw(value); setFilename(asset.name); setConfirmed(false); }, 'اختر بيانات دخول النسخة')}/><BodyText>{filename}</BodyText><Input label="رقم هاتف صاحب النسخة" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><Input label="كلمة مرور النسخة" value={password} onChangeText={setPassword} secureTextEntry/>
    <BodyText>الاستعادة تستبدل بيانات المكتب على هذا الجهاز. صدّر نسخة حالية أولاً إذا أردت الاحتفاظ بها.</BodyText><Button label={confirmed ? '✓ أؤكد استبدال بيانات هذا الجهاز' : 'تأكيد استبدال بيانات هذا الجهاز'} variant="secondary" onPress={() => setConfirmed(!confirmed)}/><Button label="التحقق من النسخة واستعادتها" disabled={op.busy || !raw || !confirmed} onPress={() => void op.run(async () => { await restoreEncryptedBackup(raw, phone, password); resetRepositories(); setRaw(''); setPassword(''); router.replace('/login'); }, 'تمت الاستعادة؛ سجل الدخول')}/></Card>
    {op.error || op.message ? <Text accessibilityLiveRegion="polite" style={featureStyles.text}>{op.error || op.message}</Text> : null}
  </FormPage>;
}
