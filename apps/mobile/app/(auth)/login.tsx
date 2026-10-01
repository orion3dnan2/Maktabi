import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { colors } from '@maktabi/ui';
import { GoldButton, row } from '@/components/luxe';
import { useAuth } from '@/auth/AuthProvider';
import { VaultPasswordMismatch } from '@/data/vault';
import { AuthField, AuthLayout, authStyles } from '@/features/auth/AuthLayout';

const REMEMBER_KEY = 'maktabi:remember-phone';

export default function LoginScreen() {
  const router = useRouter(); const auth = useAuth();
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [localDataLocked, setLocalDataLocked] = useState(false);
  useEffect(() => { void AsyncStorage.getItem(REMEMBER_KEY).then((p) => { if (p) setPhone(p); }).catch(() => undefined); }, []);

  const submit = async (discardLocal = false) => {
    if (busy) return;
    if (!phone.trim() || !password) { setError('أدخل رقم الهاتف وكلمة المرور للمتابعة'); return; }
    setBusy(true); setError(''); setLocalDataLocked(false);
    try {
      await (discardLocal ? auth.signInDiscardingLocalData(phone, password) : auth.signIn(phone, password));
      if (remember) await AsyncStorage.setItem(REMEMBER_KEY, phone); else await AsyncStorage.removeItem(REMEMBER_KEY);
      setPassword('');
    } catch (e) {
      if (e instanceof VaultPasswordMismatch) { setLocalDataLocked(true); setError(`${e.message} أدخل كلمة المرور القديمة، أو ابدأ بيانات جديدة على هذا الجهاز.`); }
      else setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول');
    } finally { setBusy(false); }
  };
  const confirmDiscard = () => {
    const message = 'سيتم حذف ما حُفظ لهذا الحساب على هذا الجهاز فقط (المواعيد والمستندات والأتعاب وإعدادات المكتب). بيانات العملاء والقضايا على الخادم لا تتأثر. لا يمكن التراجع.';
    if (Platform.OS === 'web') { if (globalThis.confirm?.(message)) void submit(true); return; }
    Alert.alert('بدء بيانات جديدة', message, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف والمتابعة', style: 'destructive', onPress: () => void submit(true) }]);
  };

  return <AuthLayout title="تسجيل الدخول" subtitle="أدخل رقم هاتفك وكلمة المرور التي أعطاك إياها مدير مكتبك.">
    <AuthField icon="call-outline" error={!!error && !phone.trim()} value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" autoCapitalize="none" autoCorrect={false} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" accessibilityLabel="رقم الهاتف" style={{ writingDirection: phone ? 'ltr' : 'rtl' }}/>
    <AuthField icon="lock-closed-outline" error={!!error && !password} value={password} onChangeText={setPassword} secureTextEntry={!visible} placeholder="كلمة المرور" autoComplete="current-password" textContentType="password" accessibilityLabel="كلمة المرور" onSubmitEditing={() => void submit()}
      end={<Pressable accessibilityRole="button" accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setVisible(!visible)} hitSlop={10}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted}/></Pressable>}/>
    {error ? <Text accessibilityLiveRegion="polite" style={authStyles.error}>{error}</Text> : null}
    <View style={[authStyles.options, { flexDirection: row }]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember(!remember)} style={[authStyles.remember, { flexDirection: row }]}>
        <View style={[authStyles.checkbox, remember && authStyles.checked]}>{remember ? <Ionicons name="checkmark" color={colors.white} size={16}/> : null}</View>
        <Text style={authStyles.optionText}>تذكر رقمي</Text>
      </Pressable>
    </View>
    <GoldButton label={busy ? 'جارٍ الدخول…' : 'دخول'} onPress={() => void submit()}/>
    {localDataLocked ? <Pressable accessibilityRole="button" onPress={confirmDiscard} style={authStyles.secondary}><Text style={authStyles.secondaryText}>بدء بيانات جديدة على هذا الجهاز</Text></Pressable> : null}
    <Text style={authStyles.note}>نسيت كلمة المرور؟ اطلب من مدير مكتبك تعيين كلمة مرور جديدة لك.</Text>
    <Pressable accessibilityRole="link" onPress={() => router.push('/request-office')} hitSlop={8}><Text style={authStyles.link}>ليس لديك حساب؟ اطلب مكتباً تجريبياً</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => router.push('/owner-setup')} hitSlop={8}><Text style={authStyles.link}>إعداد حساب مالك المنصة (برمز إعداد)</Text></Pressable>
    <View style={[authStyles.secure, { flexDirection: row }]}><Ionicons name="lock-closed" size={16} color={colors.muted}/><Text style={authStyles.note}>اتصال مشفّر · كل مكتب يرى بياناته فقط</Text></View>
  </AuthLayout>;
}
