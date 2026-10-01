import { describe, expect, it } from 'vitest';
import type { Client, Matter } from '@maktabi/domain';
import { createLocalRepositories } from './localRepositories';
const client: Client = { id: 'c', officeId: 'cloud-office', kind: 'PERSON', displayName: 'عدنان', phone: '+249900000001', whatsapp: '+249900000001', createdAt: '2026-09-30' };
const matter: Matter = { id: 'm', officeId: 'cloud-office', title: 'ملف مشترك', reference: 'FILE-1', type: 'CIVIL', status: 'ACTIVE', authority: 'محكمة', openedAt: '2026-09-30', details: {}, parties: [{ id: 'p', matterId: 'm', clientId: 'c', displayName: 'عدنان', role: 'CLIENT', isPrimary: true }] };
describe('legacy workflow bridge to shared cases', () => {
  it('starts empty and retains local appointments, notes and receipts through hydration and restart', async () => {
    let raw: string | null = null;
    const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
    let current = { clients: [client], matters: [matter] };
    const shared = async () => structuredClone(current);
    const r = createLocalRepositories(storage, shared);
    expect(await r.clientRepository.getById('c1')).toBeNull();
    await r.workflowRepository.addAppointment('m', { title: 'جلسة', startsAt: '2026-10-05T09:00:00Z' });
    await r.workflowRepository.addNote('m', 'ملاحظة محلية محفوظة');
    await r.workflowRepository.setFees('m', 10000);
    await r.workflowRepository.recordPayment('m', { id: 'receipt', number: 'R-1', amount: 2000, method: 'نقدي', date: '2026-09-30T10:00:00Z' });
    current = { clients: [client], matters: [{ ...matter, title: 'عنوان جديد من الخادم' }] };
    const restarted = createLocalRepositories(storage, shared);
    expect(await restarted.matterRepository.getById('m')).toMatchObject({ title: 'عنوان جديد من الخادم', nextEventAt: '2026-10-05T09:00:00.000Z', currentStage: 'ملاحظة محلية محفوظة' });
    expect((await restarted.workflowRepository.getByMatter('m')).receipts).toHaveLength(1);
    expect(await restarted.profileRepository.getByClient('c')).toMatchObject({ agreedFees: 10000, paidFees: 2000 });
  });
});
