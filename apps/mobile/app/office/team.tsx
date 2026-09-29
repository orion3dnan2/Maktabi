import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyText, Button, ChoiceField, EmptyState, ErrorState, Input, LoadingState, colors, typography } from '@maktabi/ui';
import { HeroHeader, LuxeCard, Pill, row, rtl, SectionTitle, Sheet } from '@/components/luxe';
import { supabase, manageUsers } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { roleLabels, type OfficeRole } from '@/auth/access';
import { generatePassword } from '@/auth/password';
import { MIN_PASSWORD_LENGTH } from '@/data/vault';
import { useResource } from '@/features/shared/hooks';
import { useOperation } from '@/features/shared/useOperation';

interface Member { id: string; full_name: string; phone: string | null; role: OfficeRole; is_active: boolean; client_id: string | null }
const staffRoles = (['lawyer', 'employee', 'reception', 'admin'] as const).map((value) => ({ value, label: roleLabels[value] }));
const empty = { name: '', phone: '', role: 'lawyer', password: '' };

/** Office admin: add staff accounts, reset passwords, deactivate accounts. */
export default function TeamScreen() {
  const router = useRouter(); const { access } = useAuth();
  const members = useResource(useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, phone, role, is_active, client_id').eq('office_id', access?.office?.id ?? '').order('created_at');
    if (error) throw error;
    return (data ?? []) as Member[];
  }, [access?.office?.id]));
  const op = useOperation(members.reload);
  const [form, setForm] = useState(empty); const [notice, setNotice] = useState('');
  const [resetFor, setResetFor] = useState<Member>(); const [newPassword, setNewPassword] = useState('');
  const set = (key: keyof typeof empty) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const addMember = () => void op.run(async () => {
    if (!form.name.trim() || !form.phone.trim()) throw new Error('أدخل الاسم ورقم الهاتف');
    if (form.password.length < MIN_PASSWORD_LENGTH) throw new Error(`كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`);
    const result = await manageUsers<{ phone: string }>('create_member', { full_name: form.name.trim(), phone: form.phone, role: form.role, password: form.password });
    setNotice(`تمت إضافة ${form.name.trim()} (${roleLabels[form.role as OfficeRole]}). بيانات الدخول:\nالهاتف: ${result.phone}\nكلمة المرور: ${form.password}`);
    setForm(empty);
  }, 'تمت الإضافة');
  const resetPassword = () => void op.run(async () => {
    if (!resetFor) return;
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`);
    await manageUsers('reset_password', { user_id: resetFor.id, password: newPassword });
    setNotice(`كلمة المرور الجديدة لـ ${resetFor.full_name}: ${newPassword}`);
    setResetFor(undefined); setNewPassword('');
  }, 'تم تعيين كلمة المرور');
  const toggleActive = (m: Member) => void op.run(async () => {
    const { error } = await supabase.from('profiles').update({ is_active: !m.is_active }).eq('id', m.id);
    if (error) throw new Error(error.message.includes('at least one active admin') ? 'يجب أن يبقى مدير نشط واحد على الأقل' : 'تعذر تغيير حالة الحساب');
  }, m.is_active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');

  const staff = members.data?.filter((m) => m.role !== 'client') ?? [];
  const portal = members.data?.filter((m) => m.role === 'client') ?? [];
  const renderMember = (m: Member) => <View key={m.id} style={styles.member}>
    <View style={[styles.head, { flexDirection: row }]}>
      <Text style={styles.name}>{m.full_name || '—'}</Text>
      <Pill label={m.is_active ? roleLabels[m.role] : 'موقوف'} tone={m.is_active ? 'gold' : 'red'}/>
    </View>
    {m.phone ? <Text style={[styles.meta, { writingDirection: 'ltr', textAlign: 'right' }]}>{m.phone}</Text> : null}
    {m.id === access?.user_id ? <Text style={styles.meta}>أنت</Text> : <View style={[styles.actions, { flexDirection: row }]}>
      <View style={styles.action}><Button label="كلمة مرور جديدة" variant="secondary" disabled={op.busy} onPress={() => { setResetFor(m); setNewPassword(generatePassword()); setNotice(''); }}/></View>
      <View style={styles.action}><Button label={m.is_active ? 'إيقاف' : 'تفعيل'} variant="ghost" disabled={op.busy} onPress={() => toggleActive(m)}/></View>
    </View>}
    {resetFor?.id === m.id ? <View style={styles.reset}>
      <Input label="كلمة المرور الجديدة" value={newPassword} onChangeText={setNewPassword} autoCapitalize="none" autoCorrect={false}/>
      <BodyText muted>العملاء والقضايا على الخادم وتظهر له بكلمة المرور الجديدة. أما المواعيد والمستندات والأتعاب المحفوظة على جهازه فتُفتح بكلمة المرور القديمة فقط.</BodyText>
      <View style={[styles.actions, { flexDirection: row }]}>
        <View style={styles.action}><Button label="حفظ" disabled={op.busy} onPress={resetPassword}/></View>
        <View style={styles.action}><Button label="إلغاء" variant="ghost" onPress={() => setResetFor(undefined)}/></View>
      </View>
    </View> : null}
  </View>;

  return <View style={styles.page}><ScrollView keyboardShouldPersistTaps="handled">
    <HeroHeader title="فريق المكتب" subtitle={access?.office?.name}/>
    <Sheet>
      <Button label="العودة للمزيد" variant="secondary" onPress={() => router.replace('/(tabs)/more')}/>
      {notice ? <Text selectable style={styles.notice}>{notice}</Text> : null}
      {op.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{op.error}</Text> : null}
      <LuxeCard>
        <SectionTitle icon="person-add-outline" title="إضافة عضو"/>
        <Input label="الاسم الكامل" value={form.name} onChangeText={set('name')}/>
        <Input label="رقم الهاتف (يُستخدم لتسجيل الدخول)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad"/>
        <ChoiceField label="الدور" value={form.role} options={staffRoles} onChange={set('role')}/>
        <Input label={`كلمة المرور (${MIN_PASSWORD_LENGTH} أحرف على الأقل)`} value={form.password} onChangeText={set('password')} autoCapitalize="none" autoCorrect={false}/>
        <Button label="توليد كلمة مرور" variant="secondary" onPress={() => set('password')(generatePassword())}/>
        <Button label={op.busy ? 'جارٍ الإضافة…' : 'إضافة للفريق'} disabled={op.busy} onPress={addMember}/>
      </LuxeCard>
      <LuxeCard>
        <SectionTitle icon="people-outline" title="أعضاء الفريق"/>
        {members.loading && !members.data ? <LoadingState/> : members.error ? <ErrorState message={members.error} onRetry={members.reload}/> : staff.length ? staff.map(renderMember) : <EmptyState title="لا يوجد أعضاء" message="أضف أول محامٍ أو موظف من النموذج أعلاه."/>}
      </LuxeCard>
      <LuxeCard>
        <SectionTitle icon="id-card-outline" title="حسابات بوابة الموكلين"/>
        {portal.length ? portal.map(renderMember) : <BodyText muted>تُنشأ حسابات الموكلين من ملف الموكل بعد نقل بيانات الموكلين إلى الخادم (المرحلة 2).</BodyText>}
      </LuxeCard>
    </Sheet>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  member: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { justifyContent: 'space-between', alignItems: 'center' },
  name: { ...rtl, flex: 1, color: colors.navy950, fontFamily: typography.bold, fontSize: 16 },
  meta: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 14 },
  actions: { gap: 8 },
  action: { flex: 1 },
  reset: { gap: 8, paddingTop: 6 },
  notice: { ...rtl, color: colors.success, backgroundColor: colors.successBg, borderRadius: 12, padding: 12, fontFamily: typography.medium, fontSize: 14, lineHeight: 24 },
  error: { ...rtl, color: colors.danger, fontFamily: typography.medium, fontSize: 14 },
});
