import { describe, expect, it } from 'vitest';
import { accessProblem, canEditClientDetails, canOpen, canReassignMatters, canUseMatters, homeFor, type Access } from './access';

const office = { id: 'o1', name: 'مكتب', status: 'active' as const };
const user = (patch: Partial<Access>): Access => ({ user_id: 'u', full_name: 'x', phone: null, role: 'lawyer', is_active: true, client_id: null, office, platform_admin: false, ...patch });

describe('access routing', () => {
  it('sends each kind of account to its own home', () => {
    expect(homeFor(user({ role: null, office: null, platform_admin: true }))).toBe('/platform');
    expect(homeFor(user({ role: 'client', client_id: 'c1' }))).toBe('/portal');
    expect(homeFor(user({ role: 'reception' }))).toBe('/(tabs)');
  });
  it('keeps clients out of the office workspace and staff out of the portal', () => {
    const client = user({ role: 'client', client_id: 'c1' });
    for (const route of [['(tabs)'], ['clients', 'new'], ['matters', '[id]'], ['office', 'settings'], ['platform']]) expect(canOpen(client, route)).toBe(false);
    expect(canOpen(client, ['portal'])).toBe(true);
    const lawyer = user({ role: 'lawyer' });
    expect(canOpen(lawyer, ['portal'])).toBe(false);
    expect(canOpen(lawyer, ['(tabs)', 'matters'])).toBe(true);
  });
  it('limits team management to office admins and the console to the platform owner', () => {
    expect(canOpen(user({ role: 'employee' }), ['office', 'team'])).toBe(false);
    expect(canOpen(user({ role: 'admin' }), ['office', 'team'])).toBe(true);
    expect(canOpen(user({ role: 'admin' }), ['platform'])).toBe(false);
    expect(canOpen(user({ role: null, office: null, platform_admin: true }), ['platform'])).toBe(true);
  });
  it('mirrors the database rules for matters and client details', () => {
    const reception = user({ role: 'reception' });
    expect(canUseMatters(reception)).toBe(false);
    expect(canOpen(reception, ['matters', 'new'])).toBe(false);
    // Procedure templates follow matter access (RLS on procedure_templates).
    expect(canOpen(reception, ['office', 'procedures'])).toBe(false);
    expect(canOpen(user({ role: 'lawyer' }), ['office', 'procedures'])).toBe(true);
    expect(canOpen(reception, ['clients', 'new'])).toBe(true);
    expect(canEditClientDetails(reception)).toBe(false);
    for (const role of ['admin', 'lawyer', 'employee'] as const) {
      expect(canUseMatters(user({ role }))).toBe(true);
      expect(canEditClientDetails(user({ role }))).toBe(true);
      expect(canReassignMatters(user({ role }))).toBe(role === 'admin');
    }
    expect(canUseMatters(user({ role: 'client', client_id: 'c1' }))).toBe(false);
    expect(canUseMatters(user({ role: 'admin', is_active: false }))).toBe(false);
    expect(canUseMatters(undefined)).toBe(false);
    for (const status of ['pending', 'rejected'] as const) {
      const requester = user({ role: 'admin', office: { ...office, status } });
      expect(canUseMatters(requester)).toBe(false);
      expect(canOpen(requester, ['(tabs)'])).toBe(false);
    }
  });
  it('never lets a signed-in user stay on the sign-in screens or splash', () => {
    expect(canOpen(user({}), ['(auth)', 'login'])).toBe(false);
    expect(canOpen(user({}), [])).toBe(false);
  });
  it('explains unusable accounts', () => {
    expect(accessProblem(user({ role: null, office: null }))).toMatch('غير مرتبط');
    expect(accessProblem(user({ is_active: false }))).toMatch('إيقاف');
    expect(accessProblem(user({ office: { ...office, status: 'suspended' } }))).toMatch('موقوف');
    expect(accessProblem(user({ role: 'admin', office: { ...office, status: 'pending' } }))).toMatch('قيد المراجعة');
    expect(accessProblem(user({ role: 'admin', office: { ...office, status: 'rejected' } }))).toMatch('لم تتم الموافقة');
    expect(accessProblem(user({}))).toBeNull();
    expect(accessProblem(undefined)).not.toBeNull();
  });
});
