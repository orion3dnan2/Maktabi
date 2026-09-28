import type { MatterType } from '@maktabi/domain';
import type { Attachment } from './workflow';
import type { ReadinessSubmission } from './readiness';

export type StageStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
export interface ProcedureTemplate { id: string; name: string; types: MatterType[]; stages: { name: string; authority: string; requirements: string[] }[] }
export interface ProcedureStage {
  id: string; name: string; authority: string; reference: string; date: string; status: StageStatus;
  details: Record<string, string>; requirements: { title: string; done: boolean }[];
  documentIds: string[]; notes: string; nextAt?: string; completedAt?: string;
}
export interface CaseDeadline { id: string; title: string; dueAt: string; source: string; completed: boolean }
export interface FeeInstallment { id: string; title: string; amount: number; dueDate: string; stageId?: string }
export interface ExpenseEntry { id: string; date: string; category: string; amount: number; recipient: string; stageId?: string; billId?: string; source: 'TRUST' | 'RECEIVABLE'; voidReason?: string }
export interface TrustDeposit { id: string; date: string; amount: number; description: string }
export interface OfficeSettings { name: string; address: string; phone: string; receiver: string; receiptPrefix: string; logo?: Attachment; seal?: Attachment; trustLowBalance: number }
export interface OfficeData { settings: OfficeSettings; templates: ProcedureTemplate[]; counters: Record<string, number>; readiness: ReadinessSubmission[] }
export const defaultOffice = (): OfficeData => ({ settings: { name: 'مكتبي', address: '', phone: '', receiver: '', receiptPrefix: 'RC', trustLowBalance: 10000 }, templates: [], counters: {}, readiness: [] });
const stages = (authority: string, names: string[], requirements: string[] = []) => names.map((name) => ({ name, authority, requirements }));
export const builtinProcedures: ProcedureTemplate[] = [
  { id: 'criminal', name: 'جنائي: الشرطة والنيابة والمحكمة', types: ['CRIMINAL'], stages: [
    ...stages('الشرطة', ['فتح البلاغ', 'تدوين الأقوال', 'الاستدعاء والتحري', 'الضبط والتفتيش', 'الحجز أو الإفراج بالضمان', 'الإحالة إلى النيابة']),
    ...stages('النيابة', ['قيد الدعوى والتحقيق', 'أوامر القبض أو الحبس', 'الإفراج بالضمان', 'التصرف في التحقيق', 'التظلم من قرارات النيابة']),
    ...stages('المحكمة', ['قيد الدعوى', 'الإعلان', 'الرد', 'الإثبات والشهود', 'المرافعة', 'الحكم']),
  ] },
  { id: 'trial', name: 'التقاضي أمام أول درجة', types: ['CIVIL', 'PERSONAL_STATUS', 'LABOUR', 'SPECIAL_COURT', 'OTHER'], stages: stages('المحكمة', ['قيد الدعوى', 'الإعلان', 'الرد', 'الإثبات والشهود', 'المرافعة', 'الحكم']) },
  { id: 'appeal', name: 'الاستئناف', types: ['CRIMINAL', 'CIVIL', 'PERSONAL_STATUS', 'LABOUR', 'SPECIAL_COURT'], stages: stages('محكمة الاستئناف', ['تقديم العريضة', 'سداد الرسوم', 'إعلان الطرف الآخر', 'الجلسات', 'حكم الاستئناف']) },
  { id: 'supreme', name: 'الطعن بالنقض', types: ['CRIMINAL', 'CIVIL', 'PERSONAL_STATUS', 'LABOUR', 'SPECIAL_COURT'], stages: stages('المحكمة العليا', ['عريضة الطعن', 'الرسوم', 'الفحص', 'الجلسة', 'الحكم']) },
  { id: 'review', name: 'المراجعة', types: ['CRIMINAL', 'CIVIL', 'PERSONAL_STATUS', 'LABOUR', 'SPECIAL_COURT'], stages: stages('جهة المراجعة', ['تقديم طلب المراجعة', 'النظر في الطلب', 'القرار']) },
  { id: 'execution', name: 'التنفيذ', types: ['CRIMINAL', 'CIVIL', 'PERSONAL_STATUS', 'LABOUR', 'SPECIAL_COURT'], stages: stages('محكمة التنفيذ', ['طلب التنفيذ', 'الإعلان', 'الحجز', 'التنفيذ أو التسوية']) },
  { id: 'commercial', name: 'المسجل التجاري', types: ['COMMERCIAL_REGISTRY'], stages: stages('المسجل التجاري', ['حجز الاسم', 'عقد التأسيس والنظام', 'تقديم الطلب وسداد الرسوم', 'الفحص والمراجعة', 'شهادة التسجيل', 'تعديل البيانات', 'شهادة البحث', 'التجديد', 'التصفية والشطب'], ['هوية مقدم الطلب', 'المستندات المطلوبة من الجهة', 'إثبات سداد الرسوم']) },
  { id: 'land', name: 'مسجل عام الأراضي', types: ['LAND_REGISTRY'], stages: stages('مسجل عام الأراضي', ['شهادة البحث', 'فحص الملكية والقيود', 'تحرير العقد', 'تقديم الطلب وسداد الرسوم', 'نقل الملكية والتسجيل', 'الرهن أو فكه', 'الفرز أو الدمج', 'تعديل البيانات', 'استلام الشهادة'], ['إثبات الهوية', 'مستند الملكية', 'إثبات سداد الرسوم']) },
];

export const procedureFields: Record<string, Record<string, string>> = {
  'الشرطة': { station: 'قسم / مركز الشرطة', reportTime: 'وقت البلاغ', complainant: 'المبلغ', accused: 'المتهم', witnesses: 'الشهود', charge: 'التهمة', article: 'المادة القانونية (مرجع المحامي)', officer: 'المحقق / ضابط التحري', custody: 'حالة المتهم', bailAmount: 'مبلغ الضمان', guarantor: 'الضامن' },
  'النيابة': { prosecutor: 'النيابة ووكيل النيابة', referralDate: 'تاريخ الإحالة', charges: 'التهم', parties: 'الأطراف', orderDate: 'تاريخ أمر القبض / الحبس', orderDuration: 'مدة الأمر', bail: 'حالة الضمان', disposition: 'التصرف في التحقيق' },
  'المحكمة': { level: 'درجة المحكمة', bench: 'الدائرة / القاضي', parties: 'الأطراف وصفاتهم', claims: 'الطلبات', rulingDate: 'تاريخ صدور الحكم', serviceDate: 'تاريخ إعلان الحكم', ruling: 'منطوق الحكم' },
  'المسجل التجاري': { entity: 'اسم المنشأة / الشركة', legalForm: 'الشكل القانوني', registration: 'رقم التسجيل', capital: 'رأس المال', purpose: 'الغرض', partners: 'الملاك / الشركاء ونسبهم', manager: 'المدير', address: 'العنوان', registeredAt: 'تاريخ التسجيل', expiry: 'تاريخ انتهاء الترخيص', fees: 'رسوم المعاملة' },
  'مسجل عام الأراضي': { plot: 'رقم القطعة', block: 'المربع', location: 'الموقع / المحلية', area: 'المساحة', landType: 'نوع الأرض واستخدامها', owner: 'المالك المسجل', title: 'رقم السجل / الشهادة', restrictions: 'القيود والحقوق', parties: 'أطراف المعاملة', value: 'قيمة المعاملة', fees: 'رسوم المعاملة' },
};
export const expenseCategories = ['رسوم محكمة', 'رسوم تسجيل', 'طوابع', 'مواصلات', 'نسخ وتصوير', 'خبراء', 'إعلانات', 'أخرى'];
