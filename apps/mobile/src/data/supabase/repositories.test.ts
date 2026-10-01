import { describe, expect, it } from 'vitest';
import type { Client, Matter } from '@maktabi/domain';
import { fakeDb, step, type FakeCall } from '../../test/fakeDb';
import { createSupabaseClientRepository } from './clientRepository';
import { RepositoryError } from './errors';
import { MATTER_SELECT, type ClientRow, type MatterQueryRow } from './mappers';
import { createSupabaseMatterRepository } from './matterRepository';

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const M1 = '33333333-3333-4333-8333-333333333333';
const M2 = '77777777-7777-4777-8777-777777777777';

const row = (id: string, name: string): ClientRow => ({
  id, office_id: 'office', client_type: 'individual', full_name: name, phone: '+249900000101', whatsapp: '+249900000101', contact_person: null,
  registration_number: null, address: null, notes: null, email: null, civil_id: null, id_type: null, id_country: null, nationality: null,
  secondary_phone: null, status: 'active', metadata: {}, created_at: '2026-09-29T10:00:00Z', created_by: null, revision: 1, updated_at: '2026-09-29T10:00:00Z',
});
const client: Client = { id: C1, officeId: 'office', kind: 'PERSON', displayName: 'أمجد', phone: '+249900000101', whatsapp: '+249900000101', createdAt: '' };
const matterRow = (id: string): MatterQueryRow => ({
  id, office_id: 'office', client_id: C1, assigned_lawyer_id: null, matter_number: `REF-${id.slice(0, 4)}`, title: 'قضية', description: null,
  matter_type: 'civil', court_name: 'محكمة', status: 'open', opened_at: '2026-09-01', details: {}, created_at: '2026-09-01T00:00:00Z',
  client: { id: C1, full_name: 'أمجد' }, lawyer: null, parties: [],
});
const matter: Matter = {
  id: M1, officeId: 'office', reference: 'MK-1', title: 'قضية', type: 'CIVIL', status: 'ACTIVE', openedAt: '2026-09-01', authority: 'محكمة', details: {},
  parties: [{ id: `primary:${M1}`, matterId: M1, clientId: C1, displayName: 'أمجد', role: 'CLIENT', isPrimary: true }],
};

describe('Supabase client repository', () => {
  it('lists non-archived clients by name and maps rows', async () => {
    const { db, calls } = fakeDb(() => ({ data: [row(C1, 'أمجد')] }));
    const list = await createSupabaseClientRepository(db).listByOffice('ignored');
    expect(list.map((c) => c.displayName)).toEqual(['أمجد']);
    expect(calls[0]).toMatchObject({ table: 'clients' });
    expect(step(calls[0], 'neq')).toEqual(['status', 'archived']);
    expect(step(calls[0], 'order')).toEqual(['full_name']);
    // The office is never chosen by the app: RLS scopes the query to the session's office.
    expect(JSON.stringify(calls[0]!.steps)).not.toContain('office_id');
  });
  it('lists archived clients separately and counts the others on the server', async () => {
    const { db, calls } = fakeDb((call) => (step(call, 'select')?.[1] ? { data: null, count: 12 } : { data: [] }));
    await createSupabaseClientRepository(db).listArchived('ignored');
    expect(step(calls[0], 'eq')).toEqual(['status', 'archived']);
    expect(await createSupabaseClientRepository(db).count()).toBe(12);
    expect(step(calls[1], 'select')).toEqual(['id', { count: 'exact', head: true }]);
    expect(step(calls[1], 'neq')).toEqual(['status', 'archived']);
  });
  it('returns null for ids that are not UUIDs without calling the server', async () => {
    const { db, calls } = fakeDb();
    expect(await createSupabaseClientRepository(db).getById('c1')).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('saves with an upsert by id that never sends office_id or status', async () => {
    const { db, calls } = fakeDb(() => ({ data: null, status: 201 }));
    await createSupabaseClientRepository(db).save({ ...client, officeId: 'another-office', status: 'ARCHIVED' });
    const [payload, options] = step(calls[0], 'upsert')!;
    expect(options).toEqual({ onConflict: 'id' });
    expect(payload).toMatchObject({ id: C1, full_name: 'أمجد', client_type: 'individual' });
    expect(payload).not.toHaveProperty('office_id');
    expect(payload).not.toHaveProperty('status');
  });
  it('validates before calling the server', async () => {
    const { db, calls } = fakeDb();
    await expect(createSupabaseClientRepository(db).save({ ...client, displayName: ' ' })).rejects.toMatchObject({ kind: 'invalid' });
    await expect(createSupabaseClientRepository(db).save({ ...client, id: 'local-id' })).rejects.toBeInstanceOf(RepositoryError);
    expect(calls).toHaveLength(0);
  });
  it('archives by status (no delete) and reports rows RLS did not let it change', async () => {
    const { db, calls } = fakeDb((call) => ({ data: call.table === 'clients' && step(call, 'eq')?.[1] === C1 ? [{ id: C1 }] : [] }));
    const repository = createSupabaseClientRepository(db);
    await repository.setStatus(C1, 'ARCHIVED');
    expect(step(calls[0], 'update')).toEqual([{ status: 'archived' }]);
    expect(calls.some((c) => c.steps.some(([name]) => name === 'delete'))).toBe(false);
    await expect(repository.setStatus(C2, 'ARCHIVED')).rejects.toMatchObject({ kind: 'not_found' });
  });
  it('maps server errors to Arabic messages', async () => {
    const { db } = fakeDb(() => ({ data: null, status: 403, error: { code: '42501', message: 'reception can only update client contact details (tried full_name)' } }));
    await expect(createSupabaseClientRepository(db).save(client)).rejects.toMatchObject({ kind: 'permission', message: 'موظف الاستقبال يستطيع تعديل بيانات التواصل فقط.' });
  });
});

describe('Supabase matter repository', () => {
  it('reads matters with their client, lawyer and parties embedded, newest first', async () => {
    const { db, calls } = fakeDb(() => ({ data: [matterRow(M1)] }));
    const list = await createSupabaseMatterRepository(db).listByOffice('ignored');
    expect(list[0]).toMatchObject({ id: M1, reference: 'REF-3333', parties: [{ clientId: C1, displayName: 'أمجد', isPrimary: true }] });
    expect(step(calls[0], 'select')).toEqual([MATTER_SELECT]);
    expect(calls[0]!.steps.filter(([name]) => name === 'order').map(([, args]) => args)).toEqual([['opened_at', { ascending: false }], ['matter_number']]);
  });
  it('lists active matters by server status', async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await createSupabaseMatterRepository(db).listActive('ignored');
    expect(step(calls[0], 'eq')).toEqual(['status', 'open']);
  });
  it('finds matters where the client is primary or a party', async () => {
    const { db, calls } = fakeDb((call: FakeCall) => call.table === 'matter_parties' ? { data: [{ matter_id: M2 }, { matter_id: M2 }] } : { data: [matterRow(M1), matterRow(M2)] });
    const list = await createSupabaseMatterRepository(db).listByClient(C1);
    expect(list.map((m) => m.id)).toEqual([M1, M2]);
    expect(step(calls[0], 'eq')).toEqual(['client_id', C1]);
    expect(step(calls[1], 'or')).toEqual([`client_id.eq.${C1},id.in.(${M2})`]);
    const none = fakeDb((call) => ({ data: call.table === 'matter_parties' ? [] : [] }));
    await createSupabaseMatterRepository(none.db).listByClient(C1);
    expect(step(none.calls[1], 'eq')).toEqual(['client_id', C1]);
    expect(await createSupabaseMatterRepository(none.db).listByClient('not-a-uuid')).toEqual([]);
  });
  it('saves through save_matter with the primary client as client_id', async () => {
    const { db, calls } = fakeDb(() => ({ data: M1 }));
    await createSupabaseMatterRepository(db).save({ ...matter, parties: [...matter.parties, { id: 'temp', matterId: M1, clientId: C2, displayName: 'آخر', role: 'CLIENT', isPrimary: false }] });
    expect(calls[0]).toMatchObject({ rpc: 'save_matter', args: { p_matter: { id: M1, client_id: C1, matter_number: 'MK-1', status: 'open', matter_type: 'civil' }, p_parties: [{ id: null, client_id: C2, display_name: null, party_role: 'client' }] } });
  });
  it('refuses invalid matters locally and maps duplicate references', async () => {
    const { db, calls } = fakeDb(() => ({ data: null, status: 409, error: { code: '23505', message: 'duplicate key value violates unique constraint "matters_number_key"' } }));
    const repository = createSupabaseMatterRepository(db);
    await expect(repository.save({ ...matter, parties: [] })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
    await expect(repository.save(matter)).rejects.toMatchObject({ kind: 'duplicate', message: 'رقم الملف مستخدم بالفعل في هذا المكتب.' });
  });
  it('changes status with an update and treats an invisible matter as not found', async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await expect(createSupabaseMatterRepository(db).setStatus(M1, 'CLOSED')).rejects.toMatchObject({ kind: 'not_found' });
    expect(step(calls[0], 'update')).toEqual([{ status: 'closed' }]);
  });
  it('lists active lawyers and admins for assignment', async () => {
    const { db, calls } = fakeDb(() => ({ data: [{ id: C2, full_name: 'محامٍ' }] }));
    expect(await createSupabaseMatterRepository(db).listAssignableLawyers()).toEqual([{ id: C2, fullName: 'محامٍ' }]);
    expect(step(calls[0], 'in')).toEqual(['role', ['lawyer', 'admin']]);
    expect(step(calls[0], 'eq')).toEqual(['is_active', true]);
  });
  it('reports a lost connection in Arabic', async () => {
    const { db } = fakeDb(() => ({ data: null, status: 0, error: { code: '', message: 'TypeError: Failed to fetch' } }));
    await expect(createSupabaseMatterRepository(db).listByOffice('x')).rejects.toMatchObject({ kind: 'connection', message: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجدداً.' });
  });
});
