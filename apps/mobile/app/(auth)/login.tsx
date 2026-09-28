import { useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createVault, hasVault, unlockVault } from '@/data/vault';
import { resetRepositories } from '@/data/repositories';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, typography } from '@maktabi/ui';
import { Emblem, GoldButton, HeroBackdrop, row, rtl, type IonName } from '@/components/luxe';

function Field({ icon, error, children }: { icon: IonName; error?: boolean; children: ReactNode }) {
  return <View style={[styles.field, { flexDirection: row }, error && styles.fieldError]}><Ionicons name={icon} size={26} color={colors.navy900}/>{children}</View>;
}
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [visible, setVisible] = useState(false); const [remember, setRemember] = useState(true); const [error, setError] = useState('');
  const [exists, setExists] = useState<boolean>(); const [busy, setBusy] = useState(false); const [confirmation, setConfirmation] = useState('');
  useEffect(() => { void hasVault().then(setExists).catch(() => setError('تعذر قراءة بيانات الدخول')); void AsyncStorage.getItem('maktabi:remember-phone').then((p) => { if (p) setPhone(p); }); }, []);
  const login = async () => {
    if (busy || exists === undefined) return; if (!phone.trim() || !password) { setError('أدخل رقم الهاتف وكلمة المرور للمتابعة'); return; }
    if (!exists && password !== confirmation) { setError('كلمتا المرور غير متطابقتين'); return; }
    setBusy(true); setError(''); try { if (exists) await unlockVault(phone, password); else await createVault(phone, password); resetRepositories(); if (remember) await AsyncStorage.setItem('maktabi:remember-phone', phone); else await AsyncStorage.removeItem('maktabi:remember-phone'); setPassword(''); setConfirmation(''); router.replace('/(tabs)'); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر فتح المكتب'); } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <HeroBackdrop style={StyleSheet.absoluteFill} scales={false}/>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <View style={styles.emblemGlow}><Emblem size={96}/></View>
        <Text style={styles.brandName}>مكتب المحامي</Text>
        <Text style={styles.brandSub}>للاستشارات القانونية والمحاماة</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>{exists === false ? 'إعداد مكتبك' : 'تسجيل الدخول'}</Text>
        <Text style={styles.subtitle}>{exists === false ? 'سجّل هاتف مسؤول المكتب واختر كلمة مرور من 12 حرفاً أو أكثر لتشفير بياناتك على هذا الجهاز.' : 'أدخل هاتف مسؤول المكتب وكلمة المرور لفتح بيانات المكتب المحفوظة.'}</Text>
        <Field icon="call-outline" error={!!error && !phone.trim()}><TextInput value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" accessibilityLabel="رقم الهاتف" style={[styles.input, { writingDirection: phone ? 'ltr' : 'rtl' }]}/></Field>
        <Field icon="lock-closed-outline" error={!!error && !password}>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} placeholder="كلمة المرور" placeholderTextColor={colors.muted} autoComplete="current-password" accessibilityLabel="كلمة المرور" style={styles.input} onSubmitEditing={login}/>
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setVisible(!visible)} hitSlop={10}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted}/></Pressable>
        </Field>
        {exists === false ? <Field icon="lock-closed-outline"><TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} placeholder="تأكيد كلمة المرور" accessibilityLabel="تأكيد كلمة المرور" style={styles.input} onSubmitEditing={() => void login()}/></Field> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={[styles.options, { flexDirection: row }]}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember(!remember)} style={[styles.remember, { flexDirection: row }]}><View style={[styles.checkbox, remember && styles.checked]}>{remember ? <Ionicons name="checkmark" color={colors.white} size={16}/> : null}</View><Text style={styles.optionText}>تذكرني</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/office/backup')}><Text style={styles.link}>استعادة نسخة احتياطية</Text></Pressable>
        </View>
        <GoldButton label={busy ? 'جارٍ فتح المكتب…' : exists === false ? 'إنشاء مكتب مشفّر' : 'دخول'} onPress={() => void login()}/>
        <View style={[styles.or, { flexDirection: row }]}><View style={styles.line}/><Text style={styles.orText}>أو</Text><View style={styles.line}/></View>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('الدخول بالبصمة', 'الدخول بالبصمة غير مفعّل في النسخة التجريبية.')} style={({ pressed }) => [styles.bio, { flexDirection: row }, pressed && { opacity: 0.75 }]}>
          <Text style={styles.bioText}>الدخول بالبصمة</Text><MaterialCommunityIcons name="fingerprint" size={36} color={colors.gold600}/>
        </Pressable>
        <View style={[styles.secure, { flexDirection: row }]}><Ionicons name="lock-closed" size={16} color={colors.muted}/><Text style={styles.secureText}>حفظ محلي مشفّر · احتفظ بكلمة مرور النسخة الاحتياطية</Text></View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.navy950 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, justifyContent: 'center', gap: 28 },
  brand: { alignItems: 'center', gap: 6 },
  emblemGlow: { borderRadius: 80, padding: 6, backgroundColor: 'rgba(200,162,90,0.10)', marginBottom: 8 },
  brandName: { color: '#F8E9C8', fontFamily: typography.black, fontSize: 36, lineHeight: 50, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  brandSub: { color: '#E6E9EF', fontFamily: typography.medium, fontSize: 17 },
  card: { borderRadius: 28, padding: 24, gap: 16, backgroundColor: colors.cream, borderWidth: 1, borderColor: '#FFFFFF', ...elevation.raised },
  title: { textAlign: 'center', color: colors.navy950, fontFamily: typography.black, fontSize: 30, lineHeight: 42 },
  subtitle: { textAlign: 'center', writingDirection: 'rtl', color: '#5B6372', fontFamily: typography.regular, fontSize: 15, lineHeight: 26 },
  field: { minHeight: 64, borderRadius: 16, alignItems: 'center', gap: 12, paddingHorizontal: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...elevation.card, shadowOpacity: 0.05 },
  fieldError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 56, ...rtl, color: colors.ink, fontFamily: typography.medium, fontSize: 16, outlineStyle: 'none' } as never,
  error: { ...rtl, color: colors.danger, fontFamily: typography.medium, fontSize: 13 },
  options: { justifyContent: 'space-between', alignItems: 'center' },
  remember: { minHeight: 44, alignItems: 'center', gap: 10 },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.gold600, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.gold500 },
  optionText: { color: colors.navy950, fontFamily: typography.medium, fontSize: 16 },
  link: { color: colors.gold700, fontFamily: typography.bold, fontSize: 15 },
  or: { alignItems: 'center', gap: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#DCD4C3' },
  orText: { color: colors.muted, fontFamily: typography.medium, fontSize: 16 },
  bio: { minHeight: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 16, borderWidth: 1, borderColor: '#EAD9B4', backgroundColor: colors.surface },
  bioText: { color: colors.navy950, fontFamily: typography.bold, fontSize: 18 },
  secure: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  secureText: { color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
});
