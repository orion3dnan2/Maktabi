import { describe, expect, it } from 'vitest';
import type { ProcedureTemplate } from '../office';
import { appointmentFromRow, eventTitle, stageFromRow, stageToRpc, templateFromRow, templateToRow, type StageRow } from './workflowMappers';

const S1 = '44444444-4444-4444-8444-444444444444';
const stageRow = (patch: Partial<StageRow> = {}): StageRow => ({
  id: S1, office_id: 'office', matter_id: 'matter', procedure_name: 'التقاضي', position: 0, name: 'قيد الدعوى', authority: 'المحكمة',
  reference: '', stage_date: null, status: 'pending', details: {}, requirements: [], document_ids: [], notes: '', skip_reason: null,
  started_at: null, finished_at: null, created_by: null, created_at: '2026-09-29T10:00:00Z', updated_at: '2026-09-29T10:00:00Z', ...patch,
});

describe('workflow mapping', () => {
  it('maps appointment types and statuses to the three kinds and states the app shows', () => {
    const row = { id: 'a', title: 'جلسة', starts_at: '2026-10-01T09:00:00Z', stage_id: null, outcome: null };
    expect(appointmentFromRow({ ...row, status: 'scheduled', appointment_type: 'court_session' })).toEqual({ id: 'a', title: 'جلسة', startsAt: '2026-10-01T09:00:00Z', status: 'SCHEDULED', kind: 'COURT_SESSION' });
    expect(appointmentFromRow({ ...row, status: 'confirmed', appointment_type: 'consultation' })).toMatchObject({ status: 'SCHEDULED', kind: 'CLIENT_MEETING' });
    expect(appointmentFromRow({ ...row, status: 'no_show', appointment_type: 'internal_meeting' })).toMatchObject({ status: 'CANCELLED', kind: 'OTHER' });
    expect(appointmentFromRow({ ...row, status: 'completed', appointment_type: 'court_session', stage_id: S1, outcome: 'تأجيل' })).toMatchObject({ status: 'COMPLETED', stageId: S1, outcome: 'تأجيل' });
  });
  it('reads stage rows defensively and writes only the editable fields', () => {
    const stage = stageFromRow(stageRow({
      status: 'skipped', skip_reason: 'غير لازمة', finished_at: '2026-09-30T10:00:00Z', stage_date: '2026-09-20', reference: 'ق/1',
      details: { bench: 'الأولى', bad: 3 }, requirements: [{ title: 'العريضة', done: true }, { title: 'الرسوم' }, 'غير صالح'],
    }), '2026-10-05T09:00:00Z');
    expect(stage).toEqual({
      id: S1, procedure: 'التقاضي', name: 'قيد الدعوى', authority: 'المحكمة', reference: 'ق/1', date: '2026-09-20', status: 'SKIPPED',
      details: { bench: 'الأولى' }, requirements: [{ title: 'العريضة', done: true }, { title: 'الرسوم', done: false }], documentIds: [], notes: '',
      skipReason: 'غير لازمة', nextAt: '2026-10-05T09:00:00Z', completedAt: '2026-09-30T10:00:00Z',
    });
    expect(stageToRpc({ ...stage, name: ' قيد الدعوى ', date: '' })).toEqual({
      id: S1, name: 'قيد الدعوى', authority: 'المحكمة', reference: 'ق/1', stage_date: '', details: { bench: 'الأولى' }, notes: '',
      requirements: [{ title: 'العريضة', done: true }, { title: 'الرسوم', done: false }], document_ids: [],
    });
  });
  it('round-trips office templates including preserved real-estate types', () => {
    const template: ProcedureTemplate = { id: 't', name: ' مسار المكتب ', types: ['CIVIL', 'LABOUR'], stages: [{ name: 'تسوية', authority: 'المكتب', requirements: [' خطاب ', ''] }] };
    const row = templateToRow(template);
    expect(row).toEqual({ id: 't', name: 'مسار المكتب', matter_types: ['civil', 'labour'], stages: [{ name: 'تسوية', authority: 'المكتب', requirements: ['خطاب'] }] });
    expect(templateFromRow({ ...row, matter_types: ['civil', 'real_estate'], office_id: 'o', created_by: null, created_at: '', updated_at: '' }))
      .toEqual({ id: 't', name: 'مسار المكتب', types: ['CIVIL', 'REAL_ESTATE'], stages: [{ name: 'تسوية', authority: 'المكتب', requirements: ['خطاب'] }] });
  });
  it('writes activity lines in Arabic for every event the database records', () => {
    expect(eventTitle('stage_started', 'قيد الدعوى')).toBe('بدء مرحلة قيد الدعوى');
    expect(eventTitle('session_recorded', 'جلسة المرافعة')).toBe('تسجيل نتيجة جلسة: جلسة المرافعة');
    expect(eventTitle('matter_closed', null)).toBe('إغلاق القضية');
    expect(eventTitle('matter_reassigned', null)).toBe('إلغاء إسناد القضية');
    expect(eventTitle('something_new', 'x')).toBe('نشاط على القضية');
  });
});
