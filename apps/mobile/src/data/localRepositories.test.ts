import { describe, expect, it } from 'vitest';
import { createLocalRepositories } from './localRepositories';
import { emptyWorkflow } from './workflow';
import { fakeMatterSource, fakeStageSource, serverMatter } from '../test/fakeMatters';
import { readLegacySnapshot } from './legacyImport';

describe('integrated local finance and legacy recovery', () => {
  it('keeps financial records through restart and rolls back failed storage writes', async () => {
    let raw: string | null = null;
    let fail = false;
    const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { if (fail) throw new Error('disk full'); raw = value; } };
    const source = fakeMatterSource([serverMatter('m1')]);
    const r = createLocalRepositories(storage, source.source, fakeStageSource());
    await r.workflowRepository.setFees('m1', 10000);
    await r.workflowRepository.recordPayment('m1', { id: 'r', number: 'R1', amount: 2000, method: 'نقدي', date: '2026-10-01' });
    fail = true;
    await expect(r.workflowRepository.setFees('m1', 50000)).rejects.toThrow('disk full');
    expect((await r.workflowRepository.getByMatter('m1')).agreedFees).toBe(10000);
    const restarted = createLocalRepositories(storage, source.source, fakeStageSource());
    expect((await restarted.workflowRepository.getByMatter('m1')).receipts).toHaveLength(1);
  });

  it('recovers explicitly linked legacy finance without deleting original notes or appointments', async () => {
    const original = { version: 1, clients: [], matters: [serverMatter('old')], profiles: [], workflows: [['old', {
      ...emptyWorkflow(), agreedFees: 7000, notes: [{ id: 'n', text: 'ملاحظة محفوظة', date: '2026-09-30' }],
      appointments: [{ id: 'a', title: 'جلسة قديمة', startsAt: '2026-10-05T09:00:00Z', kind: 'COURT_SESSION', status: 'SCHEDULED' }],
    }]] };
    let raw = JSON.stringify(original);
    const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
    const source = fakeMatterSource([serverMatter('new'), serverMatter('other')]);
    const r = createLocalRepositories(storage, source.source, fakeStageSource(), async id => id === 'new' ? 'old' : undefined);
    expect((await r.workflowRepository.getByMatter('other')).agreedFees).toBe(0);
    expect((await r.workflowRepository.getByMatter('new')).agreedFees).toBe(7000);
    await r.workflowRepository.setFees('new', 8000);
    expect(JSON.parse(raw).version).toBe(2);
    expect(readLegacySnapshot(JSON.parse(raw)).workflows).toEqual(original.workflows);
    const restarted = createLocalRepositories(storage, source.source, fakeStageSource());
    expect((await restarted.workflowRepository.getByMatter('new')).agreedFees).toBe(8000);
    expect(await storage.getItem()).toBe(raw);
  });
});
