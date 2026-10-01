// Trial office request from the sign-in screen. The manage-users function checks the
// same rules again and creates the office as pending until the platform owner approves it.
import { MIN_PASSWORD_LENGTH } from '@/data/vault';
import { normalizePhone } from './phone';

export interface OfficeRequestForm { officeName: string; adminName: string; adminPhone: string; officePhone: string; note: string; password: string; confirmation: string }
export const emptyOfficeRequest: OfficeRequestForm = { officeName: '', adminName: '', adminPhone: '', officePhone: '', note: '', password: '', confirmation: '' };

/** The first problem with the form, or null when it can be sent. */
export function officeRequestProblem(f: OfficeRequestForm): string | null {
  if (!f.officeName.trim() || !f.adminName.trim() || !f.adminPhone.trim() || !f.password) return 'أكمل اسم المكتب واسمك ورقم هاتفك وكلمة المرور';
  if (f.officeName.trim().length > 200) return 'اسم المكتب طويل جداً';
  if (f.adminName.trim().length > 200) return 'الاسم طويل جداً';
  if (!normalizePhone(f.adminPhone)) return 'رقم الهاتف غير صحيح؛ أدخل رقم هاتف سودانياً';
  if (f.officePhone.trim() && !normalizePhone(f.officePhone)) return 'هاتف المكتب غير صحيح؛ أدخل رقم هاتف سودانياً';
  if (f.note.trim().length > 500) return 'الملاحظة طويلة جداً (500 حرف على الأكثر)';
  if (f.password.length < MIN_PASSWORD_LENGTH) return `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`;
  if (f.password.length > 72) return 'كلمة المرور طويلة جداً';
  if (f.password !== f.confirmation) return 'كلمتا المرور غير متطابقتين';
  return null;
}

/** Body of the manage-users `request_office` action. */
export const officeRequestBody = (f: OfficeRequestForm) => ({
  office_name: f.officeName.trim(), admin_name: f.adminName.trim(), admin_phone: f.adminPhone,
  office_phone: f.officePhone.trim(), note: f.note.trim(), admin_password: f.password,
});
