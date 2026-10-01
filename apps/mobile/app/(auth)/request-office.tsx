import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '@maktabi/ui';
import { GoldButton } from '@/components/luxe';
import { manageUsers } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/data/vault';
import { emptyOfficeRequest, officeRequestBody, officeRequestProblem, type OfficeRequestForm } from '@/auth/officeRequest';
import { AuthField, AuthLayout, authStyles } from '@/features/auth/AuthLayout';

/** Anyone can ask for a trial office; it opens only after the platform owner approves it. */
export default function RequestOfficeScreen() {
  const router = useRouter();
  const [form, setForm] = useState<OfficeRequestForm>(emptyOfficeRequest); const [visible, setVisible] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState<{ office: string; phone: string } | null>(null);
  const set = (key: keyof OfficeRequestForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (busy) return;
    const problem = officeRequestProblem(form);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      const result = await manageUsers<{ admin_phone: string }>('request_office', officeRequestBody(form));
      setSent({ office: form.officeName.trim(), phone: result.admin_phone }); setForm(emptyOfficeRequest);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال الطلب'); }
    finally { setBusy(false); }
  };
  const back = <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={8}><Text style={authStyles.link}>العودة لتسجيل الدخول</Text></Pressable>;

  if (sent) return <AuthLayout title="تم إرسال الطلب" subtitle={`سيراجع مالك المنصة طلب «${sent.office}». بعد الموافقة سجّل الدخول برقم هاتفك وكلمة المرور التي اخترتها.`}>
    <Text selectable style={authStyles.note}>رقم الدخول: {'⁦'}{sent.phone}{'⁩'}</Text>
    <Text style={authStyles.note}>إن حاولت الدخول قبل الموافقة ستظهر لك رسالة بأن الطلب قيد المراجعة.</Text>
    <GoldButton label="تسجيل الدخول" onPress={() => router.replace('/login')}/>
  </AuthLayout>;

  const eye = <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setVisible(!visible)} hitSlop={10}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted}/></Pressable>;
  return <AuthLayout title="طلب مكتب تجريبي" subtitle="سجّل مكتبك لتجربة التطبيق. يراجع مالك المنصة الطلب ويفعّله، ثم تدخل برقم هاتفك وتضيف فريقك.">
    <AuthField icon="business-outline" value={form.officeName} onChangeText={set('officeName')} placeholder="اسم المكتب" maxLength={200} accessibilityLabel="اسم المكتب"/>
    <AuthField icon="person-outline" value={form.adminName} onChangeText={set('adminName')} placeholder="اسمك (مدير المكتب)" maxLength={200} autoComplete="name" accessibilityLabel="اسم مدير المكتب"/>
    <AuthField icon="call-outline" value={form.adminPhone} onChangeText={set('adminPhone')} placeholder="رقم هاتفك السوداني (للدخول)" keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="رقم هاتفك" style={{ writingDirection: form.adminPhone ? 'ltr' : 'rtl' }}/>
    <AuthField icon="call-outline" value={form.officePhone} onChangeText={set('officePhone')} placeholder="هاتف المكتب (اختياري)" keyboardType="phone-pad" accessibilityLabel="هاتف المكتب" style={{ writingDirection: form.officePhone ? 'ltr' : 'rtl' }}/>
    <AuthField icon="chatbubble-ellipses-outline" value={form.note} onChangeText={set('note')} placeholder="المدينة أو ملاحظة للإدارة (اختياري)" maxLength={500} accessibilityLabel="ملاحظة للإدارة"/>
    <AuthField icon="lock-closed-outline" value={form.password} onChangeText={set('password')} secureTextEntry={!visible} placeholder="كلمة المرور" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="كلمة المرور" end={eye}/>
    <AuthField icon="lock-closed-outline" value={form.confirmation} onChangeText={set('confirmation')} secureTextEntry={!visible} placeholder="تأكيد كلمة المرور" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="تأكيد كلمة المرور" onSubmitEditing={() => void submit()}/>
    <Text style={authStyles.note}>كلمة المرور {MIN_PASSWORD_LENGTH} أحرف على الأقل. لا تُدخل بيانات موكلين حقيقية أثناء التجربة.</Text>
    {error ? <Text accessibilityLiveRegion="polite" style={authStyles.error}>{error}</Text> : null}
    <GoldButton label={busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'} onPress={() => void submit()}/>
    {back}
  </AuthLayout>;
}
