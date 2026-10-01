import { describe, expect, it } from 'vitest';
import type { Client } from '@maktabi/domain';
import { canonicalClient } from './clientFields';
const client: Client = { id: 'a', officeId: 'o', displayName: ' عدنان ', kind: 'PERSON', phone: '٠٩٠٠٠٠٠٠٠١', whatsapp: '009249900000001', createdAt: '2026-09-30' };
describe('cloud-compatible client fields', () => {
  it('normalizes Sudanese local, international and Arabic digits without mutating input', () => {
    const value = canonicalClient({ ...client, whatsapp: '+٢٤٩٩٠٠٠٠٠٠٠١', nationalId: ' ۱۲۳۴۵۶ ' });
    expect(value.phone).toBe('+249900000001'); expect(value.whatsapp).toBe(value.phone);
    expect(value.nationalId).toBe('123456'); expect(value.displayName).toBe('عدنان'); expect(client.phone).toBe('٠٩٠٠٠٠٠٠٠١');
  });
  it('rejects unsupported countries and malformed identities before local save', () => {
    expect(() => canonicalClient({ ...client, phone: '+96512345678' })).toThrow('السوداني');
    expect(() => canonicalClient({ ...client, whatsapp: '+249900000001', nationalId: 'AB123' })).toThrow('الهوية');
  });
  it('normalizes blank identity/email to absent fields and enforces server lengths', () => {
    const value = canonicalClient({ ...client, whatsapp: '+249900000001', nationalId: ' ', email: ' ' });
    expect(value.nationalId).toBeUndefined(); expect(value.email).toBeUndefined();
    expect(() => canonicalClient({ ...client, whatsapp: '+249900000001', displayName: 'x'.repeat(301) })).toThrow('الحد');
  });
});
