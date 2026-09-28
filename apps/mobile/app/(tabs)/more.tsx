import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@maktabi/ui';
import { Chevron, HeroHeader, IconBubble, LuxeCard, row, rtl, SectionTitle, Sheet } from '@/components/luxe';
import { lockVault } from '@/data/vault';
import { resetRepositories } from '@/data/repositories';
export default function MoreScreen() {
  const router = useRouter();
  const actions = [
    { title: 'إعدادات المكتب', subtitle: 'بيانات المكتب والشعار والختم والإيصالات', icon: 'settings-outline' as const, path: '/office/settings' as const },
    { title: 'النسخ الاحتياطي', subtitle: 'تصدير واستعادة نسخة مشفرة من المكتب', icon: 'cloud-download-outline' as const, path: '/office/backup' as const },
    { title: 'متطلبات تفعيل المكتب', subtitle: 'المطلوب من مكتب المحامي لتشغيل الخدمات', icon: 'checkmark-done-outline' as const, path: '/office/readiness' as const },
    { title: 'قوالب مسارات الإجراءات', subtitle: 'إنشاء وتخصيص مراحل العمل حسب نوع الملف', icon: 'git-branch-outline' as const, path: '/office/procedures' as const },
    { title: 'إضافة قضية جديدة', subtitle: 'فتح ملف وتحديد الأطراف والمحكمة', icon: 'document-text-outline' as const, path: '/matters/new' as const },
    { title: 'إضافة عميل جديد', subtitle: 'بيانات التواصل والملف القانوني', icon: 'person-add-outline' as const, path: '/clients/new' as const },
    { title: 'جدول المواعيد', subtitle: 'الجلسات ومواعيد المتابعة', icon: 'calendar-outline' as const, path: '/(tabs)/calendar' as const },
  ];
  return <View style={styles.page}><ScrollView><HeroHeader title="المزيد" subtitle="مساحة عملك القانونية"/><Sheet>
    <LuxeCard><SectionTitle icon="grid-outline" title="إجراءات سريعة"/>{actions.map((a) => <Pressable key={a.path} accessibilityRole="button" onPress={() => router.push(a.path)} style={({ pressed }) => [styles.item, { flexDirection: row }, pressed && { opacity: 0.7 }]}><IconBubble icon={a.icon}/><View style={{ flex: 1 }}><Text style={styles.title}>{a.title}</Text><Text style={styles.sub}>{a.subtitle}</Text></View><Chevron/></Pressable>)}</LuxeCard>
    <LuxeCard><SectionTitle icon="information-circle-outline" title="عن مكتب المحامي"/><Text style={styles.sub}>إدارة القضايا والعملاء والمواعيد في واجهة عربية موحّدة.</Text><Text style={styles.sub}>نسخة محلية · البيانات محفوظة على هذا الجهاز.</Text></LuxeCard>
    <Pressable accessibilityRole="button" onPress={() => { lockVault(); resetRepositories(); router.replace('/login'); }} style={styles.logout}><Text style={styles.title}>قفل المكتب وتسجيل الخروج</Text></Pressable>
  </Sheet></ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, item: { alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, title: { ...rtl, color: colors.navy950, fontFamily: typography.bold, fontSize: 16 }, sub: { ...rtl, color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 22 }, logout: { minHeight: 48, justifyContent: 'center', alignItems: 'center' } });

