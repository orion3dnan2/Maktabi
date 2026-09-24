import { describe, expect, it } from 'vitest';
import { cancelReceipt, type Matter, type Receipt } from './index';

const receipt: Receipt = { id: 'r1', officeId: 'o1', number: '0001', paymentId: 'p1', issuedAt: '2026-09-24T10:00:00Z', status: 'ACTIVE' };
describe('domain invariants', () => {
  it('centres work on a client-linked Matter', () => {
    const matter: Matter = { id: 'm1', officeId: 'o1', reference: 'M-1', title: 'عمل قانوني تجريبي', type: 'CIVIL', parties: [{ id: 'p1', matterId: 'm1', clientId: 'c1', displayName: 'عميل', role: 'CLIENT', isPrimary: true }], details: {}, status: 'ACTIVE', openedAt: '2026-09-24' };
    expect(matter.parties[0]?.clientId).toBe('c1');
  });
  it('cancels an issued receipt without deleting or changing its number', () => {
    const cancelled = cancelReceipt(receipt, '2026-09-25T10:00:00Z', 'صدر بالخطأ');
    expect(cancelled).toMatchObject({ id: 'r1', number: '0001', status: 'CANCELLED' });
    expect(receipt.status).toBe('ACTIVE');
  });
  it('refuses to cancel a receipt twice', () => {
    const cancelled = cancelReceipt(receipt, '2026-09-25T10:00:00Z', 'صدر بالخطأ');
    expect(() => cancelReceipt(cancelled, '2026-09-26T10:00:00Z', 'مرة أخرى')).toThrow('RECEIPT_ALREADY_CANCELLED');
  });
});
