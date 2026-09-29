import { describe, expect, it } from 'vitest';
import { createLocalRepositories, STORAGE_KEY } from './localRepositories';
import { appointmentISO, parseAmount } from './workflow';
import { fakeMatterSource, fakeStageSource, serverMatter } from '../test/fakeMatters';

const clientId = 'workflow-client';
const receipt = (id: string, amount: number) => ({ id, amount, number: `RC-${id}`, date: '2026-09-27T12:00:00Z', method: 'نقدي' });
function storageFixture() {
  const data = new Map<string, string>(); let fail = false;
  return { data, fail: (value: boolean) => { fail = value; }, storage: { async getItem(key: string) { return data.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('storage full'); data.set(key, value); } } };
}
async function setup() {
  const f = storageFixture(); const server = fakeMatterSource([serverMatter('one', 'CIVIL', clientId), serverMatter('two', 'CIVIL', clientId)]);
  const reload = () => createLocalRepositories(f.storage, server.source, fakeStageSource());
  return { ...f, server, reload, r: reload() };
}

describe('the part of a matter workflow kept on the device', () => {
  it('persists documents, fees and receipts across reload', async () => {
    const { r, reload } = await setup(); const w = r.workflowRepository;
    await w.addDocument('one', { id: 'doc', title: 'مستند الاختبار', name: 'test.txt', mimeType: 'text/plain', dataUri: 'data:text/plain;base64,dGVzdA==', date: '2026-09-27T12:00:00Z' });
    await w.setFees('one', 100000); await w.recordPayment('one', receipt('first', 40000));
    const restored = reload();
    const profile = await restored.profileRepository.getByClient(clientId);
    expect(profile).toMatchObject({ agreedFees: 100000, paidFees: 40000, trustBalance: 0, expenses: 0 });
    expect(profile.receipts).toHaveLength(1); expect(profile.documents).toHaveLength(1);
    const workflow = await restored.workflowRepository.getByMatter('one');
    expect(workflow.documents[0]?.dataUri).toBe('data:text/plain;base64,dGVzdA==');
    expect(workflow.activity).toHaveLength(3);
    // Appointments, stages, deadlines and notes are the server's: the device store has none.
    expect(workflow).toMatchObject({ appointments: [], stages: [], deadlines: [], notes: [] });
  });
  it('keeps case accounts separate and aggregates them without double counting after edits', async () => {
    const { r, server } = await setup();
    await r.workflowRepository.setFees('one', 10000); await r.workflowRepository.setFees('two', 20000);
    await r.workflowRepository.recordPayment('one', receipt('a', 5000));
    server.rows.get('one')!.title = 'عنوان معدل'; // edited on the server
    expect((await r.workflowRepository.getByMatter('two')).receipts).toHaveLength(0);
    expect(await r.profileRepository.getByClient(clientId)).toMatchObject({ agreedFees: 30000, paidFees: 5000 });
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
    const { r, fail, reload } = await setup(); fail(true);
    await expect(r.workflowRepository.setFees('one', 10000)).rejects.toThrow('storage full');
    expect((await r.workflowRepository.getByMatter('one')).agreedFees).toBe(0);
    fail(false); await r.workflowRepository.setFees('one', 10000);
    expect((await reload().workflowRepository.getByMatter('one')).agreedFees).toBe(10000);
  });
  it('does not overwrite unreadable stored data with empty fixtures', async () => {
    const f = storageFixture(); f.data.set(STORAGE_KEY, 'invalid json'); const r = createLocalRepositories(f.storage, fakeMatterSource([serverMatter('one')]).source, fakeStageSource());
    await expect(r.workflowRepository.setFees('one', 1000)).rejects.toThrow();
    expect(f.data.get(STORAGE_KEY)).toBe('invalid json');
  });
  it('rejects writes for matters the server does not return, and malformed attachments', async () => {
    const { r, data } = await setup(); await expect(r.workflowRepository.setFees('missing', 1000)).rejects.toThrow('القضية غير موجودة');
    expect(data.size).toBe(0);
    await expect(r.workflowRepository.addDocument('one', { id: 'd', title: 'bad', name: 'bad.pdf', mimeType: 'application/pdf', dataUri: 'blob:temporary', date: '2026-09-27' })).rejects.toThrow();
  });
});
describe('server-authoritative matter status', () => {
  it('reads the current status from the server before every write', async () => {
    const { r, server } = await setup(); await r.workflowRepository.setFees('one', 1000);
    server.rows.get('one')!.status = 'CLOSED'; // closed from another device
    await expect(r.workflowRepository.setFees('one', 2000)).rejects.toThrow('القضية مغلقة');
    server.rows.delete('two'); // no longer visible to this user (RLS)
    await expect(r.officeRepository.depositTrust('two', { id: 'd', date: '2026-09-27', amount: 100, description: 'أمانة' })).rejects.toThrow('القضية غير موجودة');
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
