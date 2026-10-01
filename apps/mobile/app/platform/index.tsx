import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyText, Button, EmptyState, ErrorState, Input, LoadingState, colors, typography } from '@maktabi/ui';
import { HeroHeader, LuxeCard, Pill, row, rtl, SectionTitle, Sheet } from '@/components/luxe';
import { supabase, manageUsers } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { generatePassword } from '@/auth/password';
import { AccountCard } from '@/features/auth/AccountCard';
import { useResource } from '@/features/shared/hooks';
import { useOperation } from '@/features/shared/useOperation';
import { MIN_PASSWORD_LENGTH } from '@/data/vault';

interface OfficeRow { id: string; name: string; name_ar: string | null; phone: string | null; status: 'active' | 'suspended' | 'closed'; created_at: string; members: number; admins: { full_name: string; phone: string | null; is_active: boolean }[] }
const statusLabel = { active: 'نشط', suspended: 'موقوف', closed: 'مغلق' } as const;
const empty = { officeName: '', officePhone: '', adminName: '', adminPhone: '', adminPassword: '' };

/** Platform owner console: create offices with their first admin, suspend or reactivate them. */
export default function PlatformScreen() {
  const { access } = useAuth();
  const offices = useResource(useCallback(async () => {
    const { data, error } = await supabase.rpc('platform_list_offices');
    if (error) throw error;
    // admins is a JSON column in the generated types; its shape is fixed by platform_list_offices().
    return (data ?? []) as unknown as OfficeRow[];
  }, []));
  const [form, setForm] = useState(empty); const [created, setCreated] = useState('');
  const op = useOperation(offices.reload);
  const set = (key: keyof typeof empty) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const createOffice = () => void op.run(async () => {
    if (!form.officeName.trim() || !form.adminName.trim() || !form.adminPhone.trim()) throw new Error('أدخل اسم المكتب واسم المدير ورقم هاتفه');
    if (form.adminPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`كلمة مرور المدير يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`);
    const result = await manageUsers<{ admin_phone: string }>('create_office', {
      office_name: form.officeName.trim(), office_name_ar: form.officeName.trim(), office_phone: form.officePhone,
      admin_name: form.adminName.trim(), admin_phone: form.adminPhone, admin_password: form.adminPassword,
    });
    setCreated(`تم إنشاء «${form.officeName.trim()}». أرسل للمدير بيانات الدخول:\nالهاتف: ${result.admin_phone}\nكلمة المرور: ${form.adminPassword}`);
    setForm(empty);
  }, 'تم إنشاء المكتب');
  const setStatus = (office: OfficeRow, status: OfficeRow['status']) => void op.run(async () => {
    const { error } = await supabase.rpc('platform_set_office_status', { p_office: office.id, p_status: status });
    if (error) throw new Error('تعذر تغيير حالة المكتب');
  }, status === 'active' ? 'تم تفعيل المكتب' : 'تم إيقاف المكتب');

  return <View style={styles.page}><ScrollView keyboardShouldPersistTaps="handled">
    <HeroHeader title="إدارة المنصة" subtitle={access?.full_name ? `مرحباً ${access.full_name}` : 'مالك المنصة'}/>
    <Sheet>
      <LuxeCard>
        <SectionTitle icon="business-outline" title="مكتب جديد"/>
        <BodyText muted>ينشئ المكتب وحساب مديره. المدير يضيف بعدها المحامين والموظفين من شاشة «فريق المكتب».</BodyText>
        <Input label="اسم المكتب" value={form.officeName} onChangeText={set('officeName')}/>
        <Input label="هاتف المكتب (اختياري)" value={form.officePhone} onChangeText={set('officePhone')} keyboardType="phone-pad"/>
        <Input label="اسم مدير المكتب" value={form.adminName} onChangeText={set('adminName')}/>
        <Input label="هاتف المدير (يُستخدم لتسجيل الدخول)" value={form.adminPhone} onChangeText={set('adminPhone')} keyboardType="phone-pad"/>
        <Input label={`كلمة مرور المدير (${MIN_PASSWORD_LENGTH} أحرف على الأقل)`} value={form.adminPassword} onChangeText={set('adminPassword')} autoCapitalize="none" autoCorrect={false}/>
        <Button label="توليد كلمة مرور" variant="secondary" onPress={() => set('adminPassword')(generatePassword())}/>
        <Button label={op.busy ? 'جارٍ الإنشاء…' : 'إنشاء المكتب'} disabled={op.busy} onPress={createOffice}/>
        {created ? <Text selectable style={styles.created}>{created}</Text> : null}
        {op.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{op.error}</Text> : null}
      </LuxeCard>
      <LuxeCard>
        <SectionTitle icon="library-outline" title="المكاتب"/>
        {offices.loading && !offices.data ? <LoadingState/> : offices.error ? <ErrorState message={offices.error} onRetry={offices.reload}/> : !offices.data?.length ? <EmptyState title="لا توجد مكاتب بعد" message="أنشئ أول مكتب من النموذج أعلاه."/> :
          offices.data.map((o) => <View key={o.id} style={styles.office}>
            <View style={[styles.officeHead, { flexDirection: row }]}>
              <Text style={styles.officeName}>{o.name_ar || o.name}</Text>
              <Pill label={statusLabel[o.status]} tone={o.status === 'active' ? 'green' : 'red'}/>
            </View>
            {o.admins.map((a) => <Text key={`${o.id}-${a.phone}`} style={styles.meta}>المدير: {a.full_name}{a.phone ? ` · \u2066${a.phone}\u2069` : ''}</Text>)}
            <Text style={styles.meta}>أعضاء الفريق: {o.members}</Text>
            <Button label={o.status === 'active' ? 'إيقاف المكتب' : 'تفعيل المكتب'} variant="secondary" disabled={op.busy} onPress={() => setStatus(o, o.status === 'active' ? 'suspended' : 'active')}/>
          </View>)}
      </LuxeCard>
      <AccountCard/>
    </Sheet>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  office: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  officeHead: { justifyContent: 'space-between', alignItems: 'center' },
  officeName: { ...rtl, flex: 1, color: colors.navy950, fontFamily: typography.bold, fontSize: 17 },
  meta: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 14, lineHeight: 22 },
  created: { ...rtl, color: colors.success, backgroundColor: colors.successBg, borderRadius: 12, padding: 12, fontFamily: typography.medium, fontSize: 14, lineHeight: 24 },
  error: { ...rtl, color: colors.danger, fontFamily: typography.medium, fontSize: 14 },
});
