import { describe, expect, it } from 'vitest';
import type { Client, Matter } from '@maktabi/domain';
import { asciiDigits, clientFromRow, clientToRow, HIDDEN_CLIENT_NAME, matterFromRow, matterToRpc, primaryPartyId, type ClientRow, type MatterQueryRow } from './mappers';

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const M1 = '33333333-3333-4333-8333-333333333333';
const P1 = '44444444-4444-4444-8444-444444444444';
const P2 = '55555555-5555-4555-8555-555555555555';
const L1 = '66666666-6666-4666-8666-666666666666';

const clientRow: ClientRow = {
  id: C1, office_id: 'office', client_type: 'organization', full_name: 'شركة الاختبار', phone: '+249900000101', whatsapp: null,
  contact_person: 'سلمى', registration_number: 'REG-1', address: 'الخرطوم', notes: null, email: 'a@example.test', civil_id: null,
  id_type: null, id_country: null, nationality: null, secondary_phone: null, status: 'archived', metadata: {},
  created_at: '2026-09-29T10:00:00Z', created_by: null, updated_at: '2026-09-29T10:00:00Z',
};

describe('client mapping', () => {
  it('reads a row into the domain model', () => {
    expect(clientFromRow(clientRow)).toEqual({
      id: C1, officeId: 'office', displayName: 'شركة الاختبار', kind: 'ORGANIZATION', phone: '+249900000101', whatsapp: undefined,
      contactPerson: 'سلمى', registration: 'REG-1', address: 'الخرطوم', notes: undefined, email: 'a@example.test', nationalId: undefined,
      status: 'ARCHIVED', createdAt: '2026-09-29T10:00:00Z',
    });
  });
  it('writes only app-owned columns, phones in Sudanese E.164, and no office or status', () => {
    const client: Client = { id: C1, officeId: 'ignored', kind: 'PERSON', displayName: '  أمجد  ', phone: '+٢٤٩ ٩٠٠\t٠٠٠ ١٠١', whatsapp: '۰۹۱۲۳۴۵۶۷۸', nationalId: ' ١٢٣٤٥ ', email: '', notes: ' ', createdAt: 'x', status: 'ARCHIVED' };
    const row = clientToRow(client);
    expect(row).toEqual({
      id: C1, client_type: 'individual', full_name: 'أمجد', phone: '+249900000101', whatsapp: '+249912345678', email: null, address: null,
      contact_person: null, registration_number: null, notes: null, civil_id: '12345', id_type: 'national_id', id_country: 'SD',
    });
    expect(row).not.toHaveProperty('office_id');
    expect(row).not.toHaveProperty('status');
    expect(clientToRow({ ...client, nationalId: '' })).toMatchObject({ civil_id: null, id_type: null, id_country: null });
    expect(clientToRow({ ...client, nationalId: '١٢٣ ٤٥٦ ۷۸۹' })).toMatchObject({ civil_id: '123456789', id_type: 'national_id', id_country: 'SD' });
    expect(asciiDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789 0123456789');
  });
});

const matterRow = (overrides: Partial<MatterQueryRow> = {}): MatterQueryRow => ({
  id: M1, office_id: 'office', client_id: C1, assigned_lawyer_id: L1, matter_number: 'MK-2026-001', title: 'مطالبة', description: 'وصف',
  matter_type: 'labour', court_name: 'محكمة العمل', status: 'on_hold', opened_at: '2026-09-01', details: { employer: 'شركة', ignored: 5 },
  created_at: '2026-09-01T00:00:00Z',
  client: { id: C1, full_name: 'الاسم الحالي للعميل' }, lawyer: { id: L1, full_name: 'المحامي المسؤول' },
  parties: [
    { id: P2, client_id: null, display_name: 'الخصم', party_role: 'opponent', created_at: '2026-09-02T00:00:00Z', client: null },
    { id: P1, client_id: C2, display_name: null, party_role: 'client', created_at: '2026-09-01T00:00:00Z', client: { id: C2, full_name: 'عميل إضافي' } },
  ],
  ...overrides,
});

describe('matter mapping', () => {
  it('builds the domain matter with the primary client and authoritative client names', () => {
    const matter = matterFromRow(matterRow());
    expect(matter).toMatchObject({
      id: M1, reference: 'MK-2026-001', title: 'مطالبة', type: 'LABOUR', status: 'ON_HOLD', authority: 'محكمة العمل', notes: 'وصف',
      openedAt: '2026-09-01', details: { employer: 'شركة' }, assignedLawyerId: L1, assignedLawyerName: 'المحامي المسؤول',
    });
    expect(matter.parties).toEqual([
      { id: primaryPartyId(M1), matterId: M1, clientId: C1, displayName: 'الاسم الحالي للعميل', role: 'CLIENT', isPrimary: true },
      { id: P1, matterId: M1, clientId: C2, displayName: 'عميل إضافي', role: 'CLIENT', isPrimary: false },
      { id: P2, matterId: M1, clientId: undefined, displayName: 'الخصم', role: 'OPPONENT', isPrimary: false },
    ]);
  });
  it('keeps links to clients hidden by RLS and reads database-only values safely', () => {
    const matter = matterFromRow(matterRow({ client: null, lawyer: null, assigned_lawyer_id: null, matter_type: 'administrative', status: 'open', details: [] }));
    expect(matter.parties[0]).toMatchObject({ clientId: C1, displayName: HIDDEN_CLIENT_NAME });
    expect(matter).toMatchObject({ type: 'OTHER', status: 'ACTIVE', details: {}, assignedLawyerId: undefined, assignedLawyerName: undefined });
    const expert = matterFromRow(matterRow({ parties: [{ id: P2, client_id: null, display_name: 'خبير', party_role: 'expert', created_at: '2026-09-02T00:00:00Z', client: null }] }));
    expect(expert.parties[1]?.role).toBe('OTHER');
  });
  it('sends the primary client as client_id and never copies client names into parties', () => {
    const matter: Matter = { ...matterFromRow(matterRow()), reference: ' MK-9 ', notes: '', details: { employer: ' شركة ', entitlements: ' ' } };
    matter.parties.push({ id: 'device-temp', matterId: M1, displayName: ' شاهد ', role: 'WITNESS', isPrimary: false });
    const { p_matter, p_parties } = matterToRpc(matter);
    expect(p_matter).toEqual({
      id: M1, client_id: C1, assigned_lawyer_id: L1, matter_number: 'MK-9', title: 'مطالبة', description: null, matter_type: 'labour',
      court_name: 'محكمة العمل', status: 'on_hold', opened_at: '2026-09-01', details: { employer: 'شركة' },
    });
    expect(p_parties).toEqual([
      { id: P1, client_id: C2, display_name: null, party_role: 'client' },
      { id: P2, client_id: null, display_name: 'الخصم', party_role: 'opponent' },
      { id: null, client_id: null, display_name: 'شاهد', party_role: 'witness' },
    ]);
  });
});
