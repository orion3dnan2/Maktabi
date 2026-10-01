import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '@maktabi/ui';
import { GoldButton } from '@/components/luxe';
import { useAuth } from '@/auth/AuthProvider';
import { manageUsers } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/data/vault';
import { AuthField, AuthLayout, authStyles } from '@/features/auth/AuthLayout';

/** One-time creation of the platform owner account with the setup code from the database. */
export default function OwnerSetupScreen() {
  const router = useRouter(); const auth = useAuth();
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [visible, setVisible] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (!code.trim() || !name.trim() || !phone.trim() || !password) { setError('أكمل جميع الحقول'); return; }
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`); return; }
    if (password !== confirmation) { setError('كلمتا المرور غير متطابقتين'); return; }
    setBusy(true); setError('');
    try { await manageUsers('bootstrap_owner', { code: code.trim(), full_name: name.trim(), phone, password }); await auth.signIn(phone, password); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء الحساب'); }
    finally { setBusy(false); }
  };
  const eye = <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setVisible(!visible)} hitSlop={10}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted}/></Pressable>;
  return <AuthLayout title="إعداد مالك المنصة" subtitle="يُستخدم مرة واحدة فقط لإنشاء حسابك كمالك للمنصة. بعدها تنشئ المكاتب ومديريها من داخل التطبيق.">
    <AuthField icon="key-outline" value={code} onChangeText={setCode} placeholder="رمز الإعداد" autoCapitalize="characters" autoCorrect={false} accessibilityLabel="رمز الإعداد" style={{ writingDirection: 'ltr' }}/>
    <AuthField icon="person-outline" value={name} onChangeText={setName} placeholder="الاسم الكامل" accessibilityLabel="الاسم الكامل"/>
    <AuthField icon="call-outline" value={phone} onChangeText={setPhone} placeholder="رقم الهاتف السوداني" keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="رقم الهاتف" style={{ writingDirection: phone ? 'ltr' : 'rtl' }}/>
    <AuthField icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry={!visible} placeholder="كلمة المرور" autoComplete="new-password" accessibilityLabel="كلمة المرور" end={eye}/>
    <AuthField icon="lock-closed-outline" value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} placeholder="تأكيد كلمة المرور" autoComplete="new-password" accessibilityLabel="تأكيد كلمة المرور" onSubmitEditing={() => void submit()}/>
    <Text style={authStyles.note}>كلمة المرور {MIN_PASSWORD_LENGTH} أحرف على الأقل. رمز الإعداد يصلك من مطوّر المنصة ويعمل مرة واحدة.</Text>
    {error ? <Text accessibilityLiveRegion="polite" style={authStyles.error}>{error}</Text> : null}
    <GoldButton label={busy ? 'جارٍ الإنشاء…' : 'إنشاء حساب المالك'} onPress={() => void submit()}/>
    <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={8}><Text style={authStyles.link}>العودة لتسجيل الدخول</Text></Pressable>
  </AuthLayout>;
}
