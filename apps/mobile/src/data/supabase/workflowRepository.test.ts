import { describe, expect, it } from 'vitest';
import { fakeDb, step, type FakeCall, type FakeResult } from '../../test/fakeDb';
import type { ProcedureStage } from '../office';
import { RepositoryError } from './errors';
import { createSupabaseWorkflowRepository } from './workflowRepository';

const M1 = '33333333-3333-4333-8333-333333333333';
const S1 = '44444444-4444-4444-8444-444444444444';
const A1 = '55555555-5555-4555-8555-555555555555';
const D1 = '66666666-6666-4666-8666-666666666666';

const byTable = (answers: Record<string, unknown>) => (call: FakeCall): FakeResult => ({ data: answers[call.table ?? call.rpc ?? ''] ?? [] });
const stage: ProcedureStage = {
  id: S1, name: 'قيد الدعوى', authority: 'المحكمة', reference: 'ق/1', date: '2026-09-20', status: 'ACTIVE', details: {}, requirements: [], documentIds: [], notes: '',
};

describe('Supabase workflow repository', () => {
  it('reads a matter workflow from the server tables and links each stage to its next session', async () => {
    const { db, calls } = fakeDb(byTable({
      appointments: [
        { id: A1, title: 'قيد الدعوى · المحكمة', starts_at: '2026-10-05T09:00:00Z', status: 'scheduled', appointment_type: 'court_session', stage_id: S1, outcome: null },
        { id: 'past', title: 'اجتماع', starts_at: '2026-09-01T09:00:00Z', status: 'completed', appointment_type: 'client_meeting', stage_id: null, outcome: null },
      ],
      matter_stages: [{ id: S1, office_id: 'o', matter_id: M1, procedure_name: 'التقاضي', position: 0, name: 'قيد الدعوى', authority: 'المحكمة', reference: '', stage_date: null, status: 'active', details: {}, requirements: [], document_ids: [], notes: '', skip_reason: null, started_at: '2026-09-29T10:00:00Z', finished_at: null, created_by: null, created_at: '', updated_at: '' }],
      matter_deadlines: [{ id: D1, office_id: 'o', matter_id: M1, title: 'مهلة الاستئناف', due_at: '2026-10-20T20:59:00Z', legal_basis: '15 يوماً', completed_at: null, completed_by: null, created_by: null, created_at: '', updated_at: '' }],
      matter_notes: [{ id: 'n', body: 'ملاحظة', created_at: '2026-09-29T11:00:00Z' }],
      matter_events: [{ id: 2, kind: 'stage_started', subject: 'قيد الدعوى', created_at: '2026-09-29T10:00:00Z' }],
      matter_progress: [{ current_stage: 'قيد الدعوى' }],
    }));
    const w = await createSupabaseWorkflowRepository(db).getByMatter(M1);
    expect(w.stages).toMatchObject([{ id: S1, status: 'ACTIVE', nextAt: '2026-10-05T09:00:00Z' }]);
    expect(w.appointments.map((a) => [a.kind, a.status])).toEqual([['COURT_SESSION', 'SCHEDULED'], ['CLIENT_MEETING', 'COMPLETED']]);
    expect(w).toMatchObject({ deadlines: [{ id: D1, source: '15 يوماً', completed: false }], notes: [{ id: 'n', text: 'ملاحظة' }], activity: [{ title: 'بدء مرحلة قيد الدعوى' }], currentStage: 'قيد الدعوى' });
    expect(calls.every((c) => JSON.stringify(step(c, 'eq')) === JSON.stringify(['matter_id', M1]))).toBe(true);
  });
  it('asks the server nothing for ids that are not UUIDs', async () => {
    const { db, calls } = fakeDb();
    const repo = createSupabaseWorkflowRepository(db);
    expect(await repo.getByMatter('local-id')).toEqual({ appointments: [], stages: [], deadlines: [], notes: [], activity: [] });
    expect(await repo.progress(['x'])).toEqual(new Map());
    await expect(repo.addNote('x', 'ملاحظة')).rejects.toBeInstanceOf(RepositoryError);
    expect(calls).toEqual([]);
  });
  it('filters progress by id for short lists and relies on RLS for long ones', async () => {
    const { db, calls } = fakeDb(() => ({ data: [{ matter_id: M1, next_event_at: '2026-10-05T09:00:00Z', current_stage: null }] }));
    const repo = createSupabaseWorkflowRepository(db);
    expect((await repo.progress([M1])).get(M1)).toEqual({ nextEventAt: '2026-10-05T09:00:00Z' });
    expect(step(calls[0], 'in')).toEqual(['matter_id', [M1]]);
    const many = Array.from({ length: 60 }, (_, i) => `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`);
    await repo.progress(many);
    expect(step(calls[1], 'in')).toBeUndefined();
  });
  it('schedules appointments with the chosen kind, never choosing the office', async () => {
    const { db, calls } = fakeDb();
    const repo = createSupabaseWorkflowRepository(db);
    await repo.addAppointment(M1, { title: ' اجتماع ', startsAt: '2026-10-05T09:00:00Z', kind: 'CLIENT_MEETING' });
    expect(step(calls[0], 'insert')).toEqual([{ matter_id: M1, title: 'اجتماع', starts_at: '2026-10-05T09:00:00.000Z', appointment_type: 'client_meeting' }]);
    await expect(repo.addAppointment(M1, { title: ' ', startsAt: '2026-10-05T09:00:00Z', kind: 'OTHER' })).rejects.toThrow('عنوان الموعد وتاريخه مطلوبان');
    expect(calls).toHaveLength(1);
  });
  it('records a session outcome and the next session in one server call', async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    const repo = createSupabaseWorkflowRepository(db);
    await repo.finishSession(M1, A1, ' تأجيل ', '2026-11-01T09:00:00Z');
    expect(calls[0]).toMatchObject({ rpc: 'finish_session', args: { p_appointment: A1, p_outcome: 'تأجيل', p_next_at: '2026-11-01T09:00:00.000Z' } });
    await repo.finishSession(M1, A1, 'حجزت للحكم');
    expect(calls[1]!.args).toEqual({ p_appointment: A1, p_outcome: 'حجزت للحكم' });
    await expect(repo.finishSession(M1, A1, '  ')).rejects.toThrow('اكتب نتيجة الجلسة');
  });
  it('saves a stage with its next session, and changes status with a plain update scoped to the matter', async () => {
    const { db, calls } = fakeDb(() => ({ data: [{ id: S1 }] }));
    const repo = createSupabaseWorkflowRepository(db);
    await repo.saveStage(M1, { ...stage, nextAt: '2026-10-05T09:00:00Z' });
    expect(calls[0]).toMatchObject({ rpc: 'save_stage', args: { p_stage: { id: S1, reference: 'ق/1', stage_date: '2026-09-20' }, p_next_at: '2026-10-05T09:00:00.000Z' } });
    await expect(repo.saveStage(M1, { ...stage, date: '2026-02-30' })).rejects.toThrow('أدخل تاريخاً صحيحاً');
    await repo.transitionStage(M1, S1, 'SKIPPED', ' غير لازمة ');
    expect(step(calls[1], 'update')).toEqual([{ status: 'skipped', skip_reason: 'غير لازمة' }]);
    expect(calls[1]!.steps.filter(([name]) => name === 'eq').map(([, args]) => args)).toEqual([['id', S1], ['matter_id', M1]]);
    await expect(repo.transitionStage(M1, S1, 'SKIPPED')).rejects.toThrow('سبب تجاوز المرحلة مطلوب');
  });
  it('reports an update that matched nothing as not found', async () => {
    const { db } = fakeDb(() => ({ data: [] }));
    await expect(createSupabaseWorkflowRepository(db).completeDeadline(M1, D1)).rejects.toMatchObject({ kind: 'not_found' });
  });
  it('shows the database workflow rules in Arabic', async () => {
    const { db } = fakeDb(() => ({ data: null, status: 400, error: { code: '55000', message: 'finish or cancel the scheduled appointments before closing the matter' } }));
    const { db: closedDb } = fakeDb(() => ({ data: null, status: 400, error: { code: '55000', message: 'the matter is closed; reopen it before changing its workflow' } }));
    await expect(createSupabaseWorkflowRepository(db).transitionStage(M1, S1, 'ACTIVE')).rejects.toThrow('أكمل المواعيد المجدولة أو ألغها قبل إغلاق القضية.');
    await expect(createSupabaseWorkflowRepository(closedDb).addNote(M1, 'x')).rejects.toThrow('القضية مغلقة؛ أعد فتحها قبل تعديل سير العمل.');
  });
  it('lists office-wide sessions and deadlines with their matter, and recent events of chosen matters', async () => {
    const matter = { id: M1, title: 'قضية', matter_number: 'MK-1', status: 'on_hold' };
    const { db, calls } = fakeDb(byTable({
      appointments: [{ id: A1, title: 'جلسة', starts_at: '2026-10-05T09:00:00Z', status: 'scheduled', appointment_type: 'court_session', stage_id: null, outcome: null, matter }],
      matter_deadlines: [{ id: D1, office_id: 'o', matter_id: M1, title: 'مهلة', due_at: '2026-10-20T20:59:00Z', legal_basis: 'x', completed_at: null, completed_by: null, created_by: null, created_at: '', updated_at: '', matter }],
      matter_events: [{ id: 9, matter_id: M1, kind: 'note_added', subject: null, created_at: '2026-09-29T11:00:00Z' }],
    }));
    const repo = createSupabaseWorkflowRepository(db);
    expect(await repo.listScheduled()).toMatchObject([{ id: A1, matter: { id: M1, reference: 'MK-1', status: 'ON_HOLD' } }]);
    expect(step(calls[0], 'in')).toEqual(['status', ['scheduled', 'confirmed']]);
    expect(await repo.listOpenDeadlines()).toMatchObject([{ id: D1, matter: { reference: 'MK-1' } }]);
    expect(step(calls[1], 'is')).toEqual(['completed_at', null]);
    expect(await repo.listRecentEvents(5, [M1])).toEqual([{ id: '9', matterId: M1, title: 'إضافة ملاحظة متابعة', date: '2026-09-29T11:00:00Z' }]);
    expect(step(calls[2], 'limit')).toEqual([5]);
    expect(await repo.listRecentEvents(5, [])).toEqual([]);
    expect(calls).toHaveLength(3);
  });
});
