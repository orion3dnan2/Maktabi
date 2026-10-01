import { validDate, type MatterStatus } from '@maktabi/domain';
import { isUuid } from '../ids';
import type { CaseDeadline, ProcedureStage, ProcedureTemplate, StageStatus } from '../office';
import type { Appointment, AppointmentKind } from '../workflow';
import type { Db } from './clientRepository';
import { messages, RepositoryError, toRepositoryError, type ServerError } from './errors';
import { inverse, matterStatuses } from './mappers';
import {
  APPOINTMENT_SELECT, appointmentFromRow, appointmentKinds, appointmentStatuses, deadlineFromRow, eventTitle,
  stageFromRow, stageStatuses, stageToRpc, templateFromRow, templateToRow,
} from './workflowMappers';

/** The part of a matter's workflow kept in Supabase. */
export interface ServerWorkflow {
  appointments: Appointment[];
  stages: ProcedureStage[];
  deadlines: CaseDeadline[];
  notes: { id: string; text: string; date: string }[];
  /** Newest first. */
  activity: { title: string; date: string }[];
  currentStage?: string;
}
export interface MatterProgress { nextEventAt?: string; currentStage?: string }
export interface MatterRef { id: string; title: string; reference: string; status: MatterStatus }
export interface ScheduledAppointment extends Appointment { matter: MatterRef }
export interface OpenDeadline extends CaseDeadline { matter: MatterRef }
export interface MatterEvent { id: string; matterId: string; title: string; date: string }

type Result<T> = { data: T | null; error: ServerError | null; status: number };
/** The data of a query, or the query's error as a RepositoryError. */
function unwrap<T>(result: Result<T>): T {
  if (result.error || result.data === null) throw toRepositoryError(result.error, result.status);
  return result.data;
}
/** Awaits a query and returns its data (for use inside Promise.all). */
const get = async <T>(query: PromiseLike<Result<T>>): Promise<T> => unwrap(await query);
function run(result: Pick<Result<unknown>, 'error' | 'status'>): void {
  if (result.error) throw toRepositoryError(result.error, result.status);
}
/** An update that matched no row: the record is gone or not visible to this user. */
function one(rows: unknown[], status: number): void {
  if (!rows.length) throw new RepositoryError('not_found', messages.notFound, { status });
}
const invalid = (message: string) => new RepositoryError('invalid', message);
const matterStatusOf = inverse(matterStatuses);
interface MatterEmbed { id: string; title: string; matter_number: string; status: string }
const matterRef = (m: MatterEmbed): MatterRef => ({ id: m.id, title: m.title, reference: m.matter_number, status: matterStatusOf.get(m.status) ?? 'ACTIVE' });
const MATTER_EMBED = 'id, title, matter_number, status';

/**
 * Appointments, procedure stages, deadlines, notes, office procedure templates and the matter
 * event log, stored in Supabase. RLS decides what the user sees and may change: the workflow of a
 * matter follows access to the matter (admin/employee: the office's matters, lawyer: their own,
 * reception and portal users: none). The database also enforces the workflow rules (stage order,
 * closed matters are read-only, a matter closes only when nothing is open); this layer only
 * checks input early so the user gets a clear message without a round trip.
 */
export function createSupabaseWorkflowRepository(db: Db) {
  const requireId = (...ids: string[]) => {
    if (!ids.every(isUuid)) throw new RepositoryError('not_found', messages.notFound);
  };

  return {
    async getByMatter(matterId: string): Promise<ServerWorkflow> {
      if (!isUuid(matterId)) return { appointments: [], stages: [], deadlines: [], notes: [], activity: [] };
      const [appointmentRows, stageRows, deadlineRows, noteRows, eventRows, progressRows] = await Promise.all([
        get(db.from('appointments').select(APPOINTMENT_SELECT).eq('matter_id', matterId).order('starts_at')),
        get(db.from('matter_stages').select('*').eq('matter_id', matterId).order('position')),
        get(db.from('matter_deadlines').select('*').eq('matter_id', matterId).order('due_at')),
        get(db.from('matter_notes').select('id, body, created_at').eq('matter_id', matterId).order('created_at', { ascending: false })),
        get(db.from('matter_events').select('id, kind, subject, created_at').eq('matter_id', matterId)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200)),
        get(db.from('matter_progress').select('current_stage').eq('matter_id', matterId)),
      ]);
      const appointments = appointmentRows.map(appointmentFromRow);
      const nextByStage = new Map(appointments.filter((a) => a.stageId && a.status === 'SCHEDULED').map((a) => [a.stageId!, a.startsAt]));
      const currentStage = progressRows[0]?.current_stage;
      return {
        appointments,
        stages: stageRows.map((row) => stageFromRow(row, nextByStage.get(row.id))),
        deadlines: deadlineRows.map(deadlineFromRow),
        notes: noteRows.map((n) => ({ id: n.id, text: n.body, date: n.created_at })),
        activity: eventRows.map((e) => ({ title: eventTitle(e.kind, e.subject), date: e.created_at })),
        ...(currentStage ? { currentStage } : {}),
      };
    },

    /** Ids of the matter's procedure stages (fees and expenses on the device may name one). */
    async stageIds(matterId: string): Promise<string[]> {
      if (!isUuid(matterId)) return [];
      return unwrap(await db.from('matter_stages').select('id').eq('matter_id', matterId)).map((s) => s.id);
    },

    /** The next scheduled appointment and the current stage of each matter (the matter_progress view). */
    async progress(matterIds: string[]): Promise<Map<string, MatterProgress>> {
      const ids = [...new Set(matterIds.filter(isUuid))];
      if (!ids.length) return new Map();
      const query = db.from('matter_progress').select('matter_id, next_event_at, current_stage');
      // A long id list would not fit in the request URL; RLS already limits the view to visible matters.
      const rows = unwrap(await (ids.length > 50 ? query : query.in('matter_id', ids)));
      return new Map(rows.flatMap((r) => (r.matter_id ? [[r.matter_id, {
        ...(r.next_event_at ? { nextEventAt: r.next_event_at } : {}),
        ...(r.current_stage ? { currentStage: r.current_stage } : {}),
      }] as const] : [])));
    },

    async addAppointment(matterId: string, item: { title: string; startsAt: string; kind: AppointmentKind }) {
      requireId(matterId);
      if (!item.title.trim() || !Number.isFinite(Date.parse(item.startsAt))) throw invalid('عنوان الموعد وتاريخه مطلوبان');
      run(await db.from('appointments').insert({
        matter_id: matterId, title: item.title.trim(), starts_at: new Date(item.startsAt).toISOString(), appointment_type: appointmentKinds[item.kind],
      }));
    },
    async setAppointmentStatus(matterId: string, appointmentId: string, next: Appointment['status']) {
      requireId(matterId, appointmentId);
      const { data, error, status } = await db.from('appointments').update({ status: appointmentStatuses[next] }).eq('id', appointmentId).eq('matter_id', matterId).select('id');
      if (error) throw toRepositoryError(error, status);
      one(data, status);
    },
    /** Records what happened in a session and, optionally, schedules the next one. */
    async finishSession(matterId: string, appointmentId: string, outcome: string, nextAt?: string) {
      requireId(matterId, appointmentId);
      if (!outcome.trim()) throw invalid('اكتب نتيجة الجلسة');
      if (nextAt !== undefined && !Number.isFinite(Date.parse(nextAt))) throw invalid('موعد الجلسة التالية غير صحيح');
      run(await db.rpc('finish_session', { p_appointment: appointmentId, p_outcome: outcome.trim(), ...(nextAt ? { p_next_at: new Date(nextAt).toISOString() } : {}) }));
    },
    async addNote(matterId: string, text: string) {
      requireId(matterId);
      if (!text.trim()) throw invalid('اكتب الملاحظة أولاً');
      if (text.trim().length > 5000) throw invalid('الملاحظة أطول من 5000 حرف');
      run(await db.from('matter_notes').insert({ matter_id: matterId, body: text.trim() }));
    },

    async appendProcedure(matterId: string, template: ProcedureTemplate) {
      requireId(matterId);
      run(await db.rpc('append_procedure', { p_matter: matterId, p_name: template.name, p_stages: template.stages.map((s) => ({ ...s })) }));
    },
    /** Saves the stage's data and schedules, moves or cancels its next court session (`nextAt`). */
    async saveStage(matterId: string, stage: ProcedureStage) {
      requireId(matterId, stage.id);
      if (!stage.name.trim() || !stage.authority.trim()) throw invalid('المرحلة والجهة مطلوبتان');
      if (stage.date.trim() && !validDate(stage.date.trim())) throw invalid('أدخل تاريخاً صحيحاً YYYY-MM-DD');
      if (stage.nextAt !== undefined && !Number.isFinite(Date.parse(stage.nextAt))) throw invalid('الموعد التالي غير صحيح');
      run(await db.rpc('save_stage', { p_stage: stageToRpc(stage), ...(stage.nextAt ? { p_next_at: new Date(stage.nextAt).toISOString() } : {}) }));
    },
    async transitionStage(matterId: string, stageId: string, next: StageStatus, reason = '') {
      requireId(matterId, stageId);
      if (next === 'SKIPPED' && !reason.trim()) throw invalid('سبب تجاوز المرحلة مطلوب');
      const patch = next === 'SKIPPED' ? { status: stageStatuses.SKIPPED, skip_reason: reason.trim() } : { status: stageStatuses[next] };
      const { data, error, status } = await db.from('matter_stages').update(patch).eq('id', stageId).eq('matter_id', matterId).select('id');
      if (error) throw toRepositoryError(error, status);
      one(data, status);
    },
    async addDeadline(matterId: string, deadline: Omit<CaseDeadline, 'id' | 'completed'>) {
      requireId(matterId);
      if (!deadline.title.trim() || !deadline.source.trim() || !Number.isFinite(Date.parse(deadline.dueAt))) throw invalid('عنوان الموعد ومصدر تحديد المهلة والتاريخ مطلوبة');
      run(await db.from('matter_deadlines').insert({ matter_id: matterId, title: deadline.title.trim(), due_at: new Date(deadline.dueAt).toISOString(), legal_basis: deadline.source.trim() }));
    },
    /** The server records the completion time and the user. */
    async completeDeadline(matterId: string, deadlineId: string) {
      requireId(matterId, deadlineId);
      const { data, error, status } = await db.from('matter_deadlines').update({ completed_at: new Date().toISOString() }).eq('id', deadlineId).eq('matter_id', matterId).select('id');
      if (error) throw toRepositoryError(error, status);
      one(data, status);
    },

    /** Procedure paths defined by the office (the built-in ones ship with the app). */
    async listTemplates(): Promise<ProcedureTemplate[]> {
      return unwrap(await db.from('procedure_templates').select('*').order('name')).map(templateFromRow);
    },
    async saveTemplate(template: ProcedureTemplate) {
      requireId(template.id);
      if (!template.name.trim() || !template.types.length || !template.stages.length || template.stages.some((s) => !s.name.trim() || !s.authority.trim()))
        throw invalid('اسم القالب والنوع والمراحل وجهاتها مطلوبة');
      run(await db.from('procedure_templates').upsert(templateToRow(template), { onConflict: 'id' }));
    },

    /** Upcoming appointments of the matters this user can open, soonest first. */
    async listScheduled(): Promise<ScheduledAppointment[]> {
      const rows = unwrap(await db.from('appointments').select(`${APPOINTMENT_SELECT}, matter:matters!appointments_matter_fk!inner(${MATTER_EMBED})`)
        .in('status', ['scheduled', 'confirmed']).order('starts_at'));
      return rows.map((row) => ({ ...appointmentFromRow(row), matter: matterRef(row.matter) }));
    },
    /** Open deadlines of the matters this user can open, soonest first. */
    async listOpenDeadlines(): Promise<OpenDeadline[]> {
      const rows = unwrap(await db.from('matter_deadlines').select(`*, matter:matters!matter_deadlines_matter_fk!inner(${MATTER_EMBED})`)
        .is('completed_at', null).order('due_at'));
      return rows.map((row) => ({ ...deadlineFromRow(row), matter: matterRef(row.matter) }));
    },
    /** The latest events, of all visible matters or of the given ones. */
    async listRecentEvents(limit: number, matterIds?: string[]): Promise<MatterEvent[]> {
      const ids = matterIds?.filter(isUuid);
      if (ids && !ids.length) return [];
      let query = db.from('matter_events').select('id, matter_id, kind, subject, created_at');
      if (ids) query = query.in('matter_id', ids);
      const rows = unwrap(await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit));
      return rows.map((e) => ({ id: String(e.id), matterId: e.matter_id, title: eventTitle(e.kind, e.subject), date: e.created_at }));
    },
  };
}
export type SupabaseWorkflowRepository = ReturnType<typeof createSupabaseWorkflowRepository>;
