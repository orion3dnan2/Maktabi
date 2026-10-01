import type { MatterType } from '@maktabi/domain';
import type { Database, Json } from '@/lib/database.types';
import type { CaseDeadline, ProcedureStage, ProcedureTemplate, StageStatus } from '../office';
import type { Appointment, AppointmentKind } from '../workflow';
import { inverse, matterTypeOf, matterTypes } from './mappers';

/**
 * Persistence ⇄ app mapping for the parts of a matter's workflow stored in Supabase:
 * appointments, procedure stages, deadlines, notes, office templates and the event log.
 */
type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];
export type StageRow = Tables['matter_stages']['Row'];
export type DeadlineRow = Tables['matter_deadlines']['Row'];
export type TemplateRow = Tables['procedure_templates']['Row'];

export const APPOINTMENT_SELECT = 'id, title, starts_at, status, appointment_type, stage_id, outcome';
export type AppointmentRow = Pick<Tables['appointments']['Row'], 'id' | 'title' | 'starts_at' | 'status' | 'appointment_type' | 'stage_id' | 'outcome'>;

export const appointmentKinds = { COURT_SESSION: 'court_session', CLIENT_MEETING: 'client_meeting', OTHER: 'other' } as const satisfies Record<AppointmentKind, Enums['appointment_type']>;
const appointmentKindOf = inverse(appointmentKinds);
// The app shows three states: a confirmed appointment is still upcoming, a no-show did not take place.
const appointmentStatusOf: Record<Enums['appointment_status'], Appointment['status']> = {
  scheduled: 'SCHEDULED', confirmed: 'SCHEDULED', completed: 'COMPLETED', cancelled: 'CANCELLED', no_show: 'CANCELLED',
};
export const appointmentStatuses = { SCHEDULED: 'scheduled', COMPLETED: 'completed', CANCELLED: 'cancelled' } as const satisfies Record<Appointment['status'], Enums['appointment_status']>;
export const stageStatuses = { PENDING: 'pending', ACTIVE: 'active', COMPLETED: 'completed', SKIPPED: 'skipped' } as const satisfies Record<StageStatus, Enums['stage_status']>;
const stageStatusOf = inverse(stageStatuses);

export function appointmentFromRow(row: AppointmentRow): Appointment {
  return {
    id: row.id, title: row.title, startsAt: row.starts_at, status: appointmentStatusOf[row.status],
    // Consultations are meetings with the client; other internal types show as "other".
    kind: row.appointment_type === 'consultation' ? 'CLIENT_MEETING' : appointmentKindOf.get(row.appointment_type) ?? 'OTHER',
    ...(row.stage_id ? { stageId: row.stage_id } : {}),
    ...(row.outcome ? { outcome: row.outcome } : {}),
  };
}

const isObject = (value: Json): value is { [key: string]: Json | undefined } => typeof value === 'object' && value !== null && !Array.isArray(value);
function detailsOf(value: Json): Record<string, string> {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}
function requirementsOf(value: Json): ProcedureStage['requirements'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (isObject(item) && typeof item.title === 'string' ? [{ title: item.title, done: item.done === true }] : []));
}

/** `nextAt` is the stage's upcoming appointment, if any. */
export function stageFromRow(row: StageRow, nextAt?: string): ProcedureStage {
  return {
    id: row.id, procedure: row.procedure_name, name: row.name, authority: row.authority, reference: row.reference,
    date: row.stage_date ?? '', status: stageStatusOf.get(row.status) ?? 'PENDING', details: detailsOf(row.details),
    requirements: requirementsOf(row.requirements), documentIds: row.document_ids, notes: row.notes,
    ...(row.skip_reason ? { skipReason: row.skip_reason } : {}),
    ...(nextAt ? { nextAt } : {}),
    ...(row.finished_at ? { completedAt: row.finished_at } : {}),
  };
}

/** The argument of public.save_stage: the fields a user edits. Status changes are separate updates. */
export function stageToRpc(stage: ProcedureStage): Json {
  return {
    id: stage.id, name: stage.name.trim(), authority: stage.authority.trim(), reference: stage.reference.trim(),
    stage_date: stage.date.trim(), details: stage.details, notes: stage.notes,
    requirements: stage.requirements.map((r) => ({ title: r.title, done: r.done })), document_ids: stage.documentIds,
  };
}

export function deadlineFromRow(row: DeadlineRow): CaseDeadline {
  return { id: row.id, title: row.title, dueAt: row.due_at, source: row.legal_basis, completed: row.completed_at !== null };
}

export function templateFromRow(row: TemplateRow): ProcedureTemplate {
  const stages = Array.isArray(row.stages) ? row.stages.flatMap((s) => (isObject(s) && typeof s.name === 'string' && typeof s.authority === 'string'
    ? [{ name: s.name, authority: s.authority, requirements: Array.isArray(s.requirements) ? s.requirements.filter((r): r is string => typeof r === 'string') : [] }]
    : [])) : [];
  return { id: row.id, name: row.name, types: row.matter_types.flatMap((t) => matterTypeOf.get(t) ?? []), stages };
}
export function templateToRow(template: ProcedureTemplate) {
  return {
    id: template.id, name: template.name.trim(),
    matter_types: template.types.map((t: MatterType) => matterTypes[t]),
    stages: template.stages.map((s) => ({ name: s.name.trim(), authority: s.authority.trim(), requirements: s.requirements.map((r) => r.trim()).filter(Boolean) })),
  };
}

/** The Arabic line shown in a matter's activity for each event the database records. */
const eventTitles: Record<string, string | ((subject: string) => string)> = {
  matter_created: 'فتح القضية',
  matter_closed: 'إغلاق القضية',
  matter_archived: 'أرشفة القضية',
  matter_on_hold: 'تعليق القضية',
  matter_resumed: 'استئناف العمل في القضية',
  matter_reopened: 'إعادة فتح القضية',
  matter_reassigned: (s) => `إسناد القضية إلى ${s}`,
  appointment_scheduled: (s) => `جدولة موعد: ${s}`,
  appointment_rescheduled: (s) => `تعديل موعد: ${s}`,
  appointment_completed: (s) => `إتمام الموعد: ${s}`,
  appointment_cancelled: (s) => `إلغاء الموعد: ${s}`,
  appointment_no_show: (s) => `لم يُعقد الموعد: ${s}`,
  session_recorded: (s) => `تسجيل نتيجة جلسة: ${s}`,
  procedure_added: (s) => `إضافة مسار: ${s}`,
  stage_started: (s) => `بدء مرحلة ${s}`,
  stage_completed: (s) => `إتمام مرحلة ${s}`,
  stage_skipped: (s) => `تجاوز مرحلة ${s}`,
  stage_updated: (s) => `تحديث بيانات مرحلة: ${s}`,
  deadline_added: (s) => `تسجيل مهلة: ${s}`,
  deadline_completed: (s) => `إتمام المهلة: ${s}`,
  note_added: 'إضافة ملاحظة متابعة',
};
export function eventTitle(kind: string, subject: string | null): string {
  const title = eventTitles[kind];
  if (typeof title === 'string') return title;
  if (title && subject) return title(subject);
  if (kind === 'matter_reassigned') return 'إلغاء إسناد القضية';
  return 'نشاط على القضية';
}
