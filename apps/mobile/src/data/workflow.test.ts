import { describe, expect, it } from 'vitest';
import { createLocalRepositories, STORAGE_KEY } from './localRepositories';
import { appointmentISO, parseAmount } from './workflow';
import { OFFICE_ID } from './mockRepositories';
import type { Client, Matter } from '@maktabi/domain';

const client: Client = { id: 'workflow-client', officeId: OFFICE_ID, kind: 'PERSON', displayName: 'عميل اختبار المسار', phone: '+249000000999', whatsapp: '+249000000999', createdAt: '2026-09-27T12:00:00Z' };
const matter = (id: string): Matter => ({ id, officeId: OFFICE_ID, title: 'قضية اختبار', reference: `WF-${id}`, type: 'CIVIL', status: 'ACTIVE', openedAt: '2026-09-27', authority: 'جهة اختبار', parties: [{ id: `party-${id}`, matterId: id, clientId: client.id, displayName: client.displayName, role: 'CLIENT', isPrimary: true }], details: {} });
const receipt = (id: string, amount: number) => ({ id, amount, number: `RC-${id}`, date: '2026-09-27T12:00:00Z', method: 'نقدي' });
function storageFixture() {
  const data = new Map<string, string>(); let fail = false;
  return { data, fail: (value: boolean) => { fail = value; }, storage: { async getItem(key: string) { return data.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('storage full'); data.set(key, value); } } };
}
async function setup() { const f = storageFixture(); const r = createLocalRepositories(f.storage); await r.clientRepository.save(client); await r.matterRepository.save(matter('one')); return { ...f, r }; }

describe('complete local client workflow', () => {
  it('persists intake, linked case, appointment, document, fees, receipt and note across reload', async () => {
    const { r, storage } = await setup(); const w = r.workflowRepository;
    await w.addAppointment('one', { title: 'الجلسة الأولى', startsAt: '2026-10-05T09:30:00Z' });
    await w.addDocument('one', { id: 'doc', title: 'مستند الاختبار', name: 'test.txt', mimeType: 'text/plain', dataUri: 'data:text/plain;base64,dGVzdA==', date: '2026-09-27T12:00:00Z' });
    await w.setFees('one', 100000); await w.recordPayment('one', receipt('first', 40000)); await w.addNote('one', 'تمت مراجعة مستندات العميل');
    const restored = createLocalRepositories(storage);
    expect(await restored.matterRepository.getById('one')).toMatchObject({ nextEventAt: '2026-10-05T09:30:00.000Z', currentStage: 'تمت مراجعة مستندات العميل' });
    const profile = await restored.profileRepository.getByClient(client.id);
    expect(profile).toMatchObject({ agreedFees: 100000, paidFees: 40000, trustBalance: 0, expenses: 0 });
    expect(profile.receipts).toHaveLength(1); expect(profile.documents).toHaveLength(1);
    const workflow = await restored.workflowRepository.getByMatter('one');
    expect(workflow.documents[0]?.dataUri).toBe('data:text/plain;base64,dGVzdA==');
    expect(workflow.activity).toHaveLength(5);
  });
  it('keeps case accounts separate and aggregates them without double counting after edits', async () => {
    const { r } = await setup(); await r.matterRepository.save(matter('two'));
    await r.workflowRepository.setFees('one', 10000); await r.workflowRepository.setFees('two', 20000);
    await r.workflowRepository.recordPayment('one', receipt('a', 5000));
    await r.matterRepository.save({ ...matter('one'), title: 'عنوان معدل' });
    expect((await r.workflowRepository.getByMatter('two')).receipts).toHaveLength(0);
    expect(await r.profileRepository.getByClient(client.id)).toMatchObject({ agreedFees: 30000, paidFees: 5000 });
  });
  it('rejects invalid and excessive payments, and fee reductions below paid amounts', async () => {
    const { r } = await setup(); const w = r.workflowRepository;
    await expect(w.recordPayment('one', receipt('no-agreement', 100))).rejects.toThrow();
    await w.setFees('one', 10000);
    for (const amount of [-1, 0, 0.5, 10001, NaN]) await expect(w.recordPayment('one', receipt(`bad${amount}`, amount))).rejects.toThrow();
    await w.recordPayment('one', receipt('valid', 6000));
    await expect(w.setFees('one', 5000)).rejects.toThrow();
    expect((await w.getByMatter('one')).receipts).toHaveLength(1);
  });
  it('serializes competing writes and deduplicates retrying the same receipt', async () => {
    const { r } = await setup(); const w = r.workflowRepository; await w.setFees('one', 10000);
    const results = await Promise.allSettled([w.recordPayment('one', receipt('a', 6000)), w.recordPayment('one', receipt('b', 6000))]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await w.recordPayment('one', receipt('a', 6000));
    expect((await w.getByMatter('one')).receipts).toHaveLength(1);
  });
  it('rolls back failed storage writes and supports retry', async () => {
    const { r, fail, storage } = await setup(); fail(true);
    await expect(r.workflowRepository.setFees('one', 10000)).rejects.toThrow('storage full');
    expect((await r.workflowRepository.getByMatter('one')).agreedFees).toBe(0);
    fail(false); await r.workflowRepository.setFees('one', 10000);
    expect((await createLocalRepositories(storage).workflowRepository.getByMatter('one')).agreedFees).toBe(10000);
  });
  it('preserves multiple appointments, advances next date and requires completion before closing', async () => {
    const { r, storage } = await setup(); const w = r.workflowRepository;
    await w.addAppointment('one', { title: 'أول', startsAt: '2026-10-01T09:00:00Z' });
    await w.addAppointment('one', { title: 'ثان', startsAt: '2026-10-02T09:00:00Z' });
    await expect(w.closeMatter('one')).rejects.toThrow();
    const appointments = (await w.getByMatter('one')).appointments;
    await w.setAppointmentStatus('one', appointments[0]!.id, 'COMPLETED');
    expect((await r.matterRepository.getById('one'))?.nextEventAt).toBe('2026-10-02T09:00:00.000Z');
    await w.setAppointmentStatus('one', appointments[1]!.id, 'CANCELLED'); await w.closeMatter('one');
    expect((await createLocalRepositories(storage).matterRepository.getById('one'))?.status).toBe('CLOSED');
    await expect(w.addNote('one', 'بعد الإغلاق')).rejects.toThrow();
  });
  it('does not overwrite unreadable stored data with empty fixtures', async () => {
    const f = storageFixture(); f.data.set(STORAGE_KEY, 'invalid json'); const r = createLocalRepositories(f.storage);
    await expect(r.clientRepository.save(client)).rejects.toThrow();
    expect(f.data.get(STORAGE_KEY)).toBe('invalid json');
  });
  it('rejects nonexistent cases and malformed attachments', async () => {
    const { r } = await setup(); await expect(r.workflowRepository.getByMatter('missing')).rejects.toThrow();
    await expect(r.workflowRepository.addDocument('one', { id: 'd', title: 'bad', name: 'bad.pdf', mimeType: 'application/pdf', dataUri: 'blob:temporary', date: '2026-09-27' })).rejects.toThrow();
  });
});
describe('workflow inputs', () => {
  it('parses Arabic money exactly and rejects ambiguous precision', () => {
    expect(parseAmount('١٬٢٣٤٫٥٠')).toBe(123450); expect(parseAmount('0.01')).toBe(1);
    for (const value of ['abc', '-1', '0', '1.001']) expect(() => parseAmount(value)).toThrow();
  });
  it('validates dates and converts local appointment time without changing wall-clock time', () => {
    const iso = appointmentISO('2026-10-05', '09:30'); const d = new Date(iso);
    expect(d.getHours()).toBe(9); expect(d.getMinutes()).toBe(30);
    expect(() => appointmentISO('2026-02-30', '09:30')).toThrow(); expect(() => appointmentISO('2026-10-05', '25:00')).toThrow();
  });
});
