import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Checkbox, colors, elevation, Emblem, gradients, HeroDecoration, layout, PrimaryButton, radius, rtl, spacing, TextField, type } from '@maktabi/ui';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identity?: string; password?: string }>({});

  const login = async () => {
    const email = identity.trim();
    const next = {
      identity: email ? undefined : 'أدخل البريد الإلكتروني',
      password: password ? undefined : 'أدخل كلمة المرور',
    };

    setErrors(next);
    if (next.identity || next.password || loading) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('تعذر تسجيل الدخول', 'تحقق من البريد الإلكتروني وكلمة المرور ثم حاول مرة أخرى.');
      return;
    }

    router.replace('/(tabs)');
  };

  return <LinearGradient colors={gradients.hero} style={styles.flex}>
    <HeroDecoration/>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Emblem size={104}/>
          <Text style={[type.display, styles.center, styles.brandName]}>مكتبي</Text>
          <Text style={[type.body, styles.center, { color: colors.onDarkMuted }]}>نظام إدارة مكاتب المحاماة والاستشارات القانونية</Text>
        </View>
        <View style={styles.sheet}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[type.title, styles.center, styles.title]}>تسجيل الدخول</Text>
            <Text style={[type.body, styles.center, { color: colors.muted }]}>مرحباً بك، سجّل الدخول للوصول إلى الملفات والعملاء والمواعيد</Text>
          </View>
          <TextField label="البريد الإلكتروني" icon="mail-outline" value={identity} onChangeText={setIdentity} autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="next" error={errors.identity}/>
          <TextField label="كلمة المرور" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="current-password" returnKeyType="go" onSubmitEditing={() => void login()} error={errors.password}
            endAdornment={<Pressable accessibilityRole="button" accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setVisible(!visible)} hitSlop={10}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted}/></Pressable>}/>
          <View style={styles.options}>
            <Checkbox checked={remember} onChange={setRemember} label="تذكرني"/>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => Alert.alert('نسيت كلمة المرور؟', 'سنربط استعادة كلمة المرور مع Supabase في الخطوة التالية.')}><Text style={styles.link}>نسيت كلمة المرور؟</Text></Pressable>
          </View>
          <PrimaryButton label={loading ? 'جارٍ الدخول...' : 'دخول'} onPress={() => void login()}/>
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted}/>
            <Text style={[type.caption, styles.center]}>تسجيل الدخول مؤمّن عبر Supabase Auth</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: layout.screenGutter + spacing.xs, gap: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.xs },
  brandName: { fontSize: 36, lineHeight: 54, color: colors.gold300, marginTop: spacing.xs },
  center: { textAlign: 'center' },
  sheet: { gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl + 4, backgroundColor: colors.surface, ...elevation.raised },
  heading: { gap: spacing.xxs, marginBottom: spacing.xxs },
  title: { fontSize: 26, lineHeight: 40, color: colors.navy900 },
  options: { flexDirection: rtl.row, justifyContent: 'space-between', alignItems: 'center' },
  link: { ...type.body, fontFamily: type.bodyStrong.fontFamily, color: colors.gold700 },
  footer: { flexDirection: rtl.row, justifyContent: 'center', alignItems: 'center', gap: spacing.xxs },
});
