import { describe, expect, it } from 'vitest';
import { createLocalStore, emptySnapshot, isLocalSnapshot, parseSnapshot } from './localStore';
import { createLocalRepositories, STORAGE_KEY } from './localRepositories';
import { fakeMatterSource, serverMatter } from '../test/fakeMatters';

const v1 = {
  version: 1,
  clients: [{ id: 'c1', displayName: 'عميل محلي' }],
  matters: [{ id: 'm1', reference: 'MK-1' }],
  profiles: [['c1', { agreedFees: 0 }]],
  workflows: [['m1', { agreedFees: 5000, receipts: [] }]],
  office: { settings: { name: 'مكتب قديم', address: '', phone: '', receiver: '', receiptPrefix: 'RC', trustLowBalance: 0 }, templates: [], counters: { 'receipt:2026': 7 }, readiness: [] },
};

describe('device-local snapshot', () => {
  it('upgrades a version-1 vault without losing records, and without reading them as live data', async () => {
    const snapshot = parseSnapshot(v1);
    expect(snapshot).toMatchObject({ version: 2, workflows: [], office: { counters: { 'receipt:2026': 7 } } });
    expect(snapshot.legacy).toEqual({ clients: v1.clients, matters: v1.matters, profiles: v1.profiles, workflows: v1.workflows });
    const data = new Map([[STORAGE_KEY, JSON.stringify(v1)]]);
    const server = fakeMatterSource([serverMatter('m1')]); // same id as a legacy local matter: still not linked to the old workflow
    const r = createLocalRepositories({ async getItem(k) { return data.get(k) ?? null; }, async setItem(k, v) { data.set(k, v); } }, server.source);
    expect((await r.workflowRepository.getByMatter('m1')).agreedFees).toBe(0);
    await r.officeRepository.saveSettings({ name: 'مكتبي', address: '', phone: '', receiver: '', receiptPrefix: 'RC', trustLowBalance: 0 });
    const stored = JSON.parse(data.get(STORAGE_KEY)!);
    expect(stored.version).toBe(2);
    expect(stored.legacy.clients).toEqual(v1.clients);
    expect(stored.office.counters).toEqual({ 'receipt:2026': 7 });
  });
  it('drops an empty version-1 snapshot without keeping a legacy section', () => {
    expect(parseSnapshot({ version: 1, clients: [], matters: [], profiles: [], workflows: [] })).toEqual({ version: 2, workflows: [], office: emptySnapshot().office });
  });
  it('refuses unknown or damaged data instead of replacing it', () => {
    for (const bad of [null, {}, { version: 3, workflows: [] }, { version: 2, workflows: {} }, { version: 1, clients: [] }]) {
      expect(isLocalSnapshot(bad)).toBe(false);
      expect(() => parseSnapshot(bad)).toThrow('تعذر قراءة البيانات المحلية');
    }
    expect(isLocalSnapshot(emptySnapshot())).toBe(true);
  });
});

describe('client profile totals', () => {
  it('counts only matters where the client is primary, from the matters the server returns', async () => {
    const primary = serverMatter('p1', 'CIVIL', 'c1');
    const secondary = { ...serverMatter('s1', 'CIVIL', 'c2'), parties: [...serverMatter('s1', 'CIVIL', 'c2').parties, { id: 'party', matterId: 's1', clientId: 'c1', displayName: 'عميل', role: 'CLIENT' as const, isPrimary: false }] };
    const server = fakeMatterSource([primary, secondary]);
    const store = createLocalStore(server.source);
    await store.workflowRepository.setFees('p1', 1000);
    await store.workflowRepository.setFees('s1', 9000);
    expect(await store.profileRepository.getByClient('c1')).toMatchObject({ agreedFees: 1000 });
    expect(server.calls).toContain('listByClient:c1');
    // With the matters already loaded (client list screen), no server call is made.
    server.calls.length = 0;
    expect(await store.profileRepository.getByClient('c2', [primary, secondary])).toMatchObject({ agreedFees: 9000 });
    expect(server.calls).toEqual([]);
  });
  it('starts a client with no local activity at zero', async () => {
    const store = createLocalStore(fakeMatterSource([]).source);
    expect(await store.profileRepository.getByClient('new')).toEqual({ agreedFees: 0, paidFees: 0, trustBalance: 0, expenses: 0, receipts: [], documents: [], activity: [] });
  });
});

describe('local progress on server matters', () => {
  it('adds the next scheduled appointment and current stage without changing the matter', async () => {
    const matter = serverMatter('one');
    const store = createLocalStore(fakeMatterSource([matter]).source);
    await store.workflowRepository.addAppointment('one', { title: 'ب', startsAt: '2026-10-09T09:00:00Z' });
    await store.workflowRepository.addAppointment('one', { title: 'أ', startsAt: '2026-10-02T09:00:00Z' });
    await store.workflowRepository.addNote('one', 'بانتظار المستندات');
    const [enriched] = await store.progress([matter]);
    expect(enriched).toMatchObject({ ...matter, nextEventAt: '2026-10-02T09:00:00.000Z', currentStage: 'بانتظار المستندات' });
    expect(matter.nextEventAt).toBeUndefined();
    const [untouched] = await store.progress([serverMatter('other')]);
    expect(untouched).toEqual(serverMatter('other'));
  });
});
