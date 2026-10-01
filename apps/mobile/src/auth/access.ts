// What a signed-in user may open. Pure functions so routing rules are unit-tested;
// the server enforces the same rules with RLS and the manage-users function.
import { can } from './permissions';

export type OfficeRole = 'admin' | 'lawyer' | 'employee' | 'reception' | 'client';
export interface Access {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: OfficeRole | null;
  is_active: boolean;
  client_id: string | null;
  office: { id: string; name: string; status: 'active' | 'suspended' | 'closed' } | null;
  platform_admin: boolean;
}

export const roleLabels: Record<OfficeRole, string> = {
  admin: 'مدير المكتب', lawyer: 'محامٍ', employee: 'موظف', reception: 'استقبال', client: 'موكل',
};

export const isStaff = (a: Access | undefined) => !!a?.role && a.role !== 'client' && a.is_active && a.office?.status === 'active';
export const canUseMatters = (a: Access | undefined) => can(a, 'view_cases');
export const canEditClientDetails = (a: Access | undefined) => isStaff(a) && a?.role !== 'reception';
export const canReassignMatters = (a: Access | undefined) => can(a, 'assign_cases');

/** Why this account cannot use the app, or null if it can. */
export function accessProblem(a: Access | null | undefined): string | null {
  if (!a) return 'تعذر قراءة بيانات الحساب';
  if (a.platform_admin && !a.office) return null;
  if (!a.office || !a.role) return 'هذا الحساب غير مرتبط بأي مكتب بعد. تواصل مع مدير مكتبك.';
  if (!a.is_active) return 'تم إيقاف هذا الحساب. تواصل مع مدير مكتبك.';
  if (a.office.status !== 'active') return 'اشتراك المكتب موقوف حالياً. تواصل مع إدارة المنصة.';
  return null;
}

export type Home = '/platform' | '/portal' | '/(tabs)';
export function homeFor(a: Access): Home {
  if (a.platform_admin && !a.office) return '/platform';
  return a.role === 'client' ? '/portal' : '/(tabs)';
}

/** May this user stay on the route whose first segments are given? */
export function canOpen(a: Access, segments: string[]): boolean {
  const [first, second] = segments;
  if (!first || first === 'index') return false;
  if (first === 'platform') return a.platform_admin;
  if (first === 'portal') return a.role === 'client';
  if (first === '(auth)') return false;
  if (first === 'office' && second === 'team') return a.role === 'admin';
  if (first === 'office' && second === 'import') return can(a, 'manage_team');
  if (first === 'office' && ['settings', 'procedures'].includes(second ?? '')) return can(a, second === 'settings' ? 'manage_office_settings' : 'manage_templates');
  if (first === 'matters' || (first === '(tabs)' && second === 'matters')) return can(a, 'view_cases');
  // Office workspace: (tabs), clients, matters, office/*
  return isStaff(a);
}
