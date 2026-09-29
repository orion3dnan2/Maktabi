import type { DashboardActivity, Deadline, Matter, Session } from '@maktabi/domain';
import type { MatterEvent, OpenDeadline, ScheduledAppointment } from './supabase/workflowRepository';
import { paidTotal, type MatterWorkflow } from './workflow';

/**
 * Dashboard figures. Clients, matters, sessions, deadlines and matter activity come from Supabase;
 * fees and receipts still come from this device's matter workflows (not synchronized yet), so the
 * money figures cover only what was recorded on this device.
 */
export interface DashboardData {
  clients: number;
  activeMatters: number;
  /** Active matters with a scheduled appointment. */
  upcoming: number;
  todaysSessions: Session[];
  /** Open deadlines of active matters, soonest first. */
  upcomingDeadlines: Deadline[];
  /** Fee installments whose due date passed and that the payments so far do not cover. */
  overdueFeeItems: number;
  outstandingFees: number;
  recentActivity: DashboardActivity[];
}

export interface DashboardSources {
  clients: number;
  /** Visible matters, with their next appointment (server progress). */
  matters: Matter[];
  /** Scheduled appointments of visible matters (server). */
  sessions: ScheduledAppointment[];
  /** Open deadlines of visible matters (server). */
  deadlines: OpenDeadline[];
  /** Latest matter events (server). */
  events: MatterEvent[];
  /** This device's part of each matter's workflow: fees, receipts and their activity. */
  finance: { matter: Matter; workflow: MatterWorkflow }[];
}
export const emptySources = (clients: number): DashboardSources => ({ clients, matters: [], sessions: [], deadlines: [], events: [], finance: [] });

const DAY = 86400000;
const sameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString();

function overdueInstallments(w: MatterWorkflow, today: string) {
  let due = 0;
  return [...w.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .filter((i) => { due += i.amount; return i.dueDate < today && due > paidTotal(w); }).length;
}

export function summarizeDashboard(s: DashboardSources, now = new Date()): DashboardData {
  const active = s.matters.filter((m) => m.status === 'ACTIVE');
  const activeById = new Map(active.map((m) => [m.id, m]));
  const byId = new Map(s.matters.map((m) => [m.id, m]));
  const today = now.toLocaleDateString('en-CA');
  return {
    clients: s.clients,
    activeMatters: active.length,
    upcoming: active.filter((m) => m.nextEventAt).length,
    todaysSessions: s.sessions.filter((a) => activeById.has(a.matter.id) && a.status === 'SCHEDULED' && sameDay(a.startsAt, now))
      .map((a): Session => ({ id: a.id, matterId: a.matter.id, title: a.title, authority: activeById.get(a.matter.id)?.authority ?? '', startsAt: a.startsAt, status: 'SCHEDULED' }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    upcomingDeadlines: s.deadlines.filter((d) => activeById.has(d.matter.id) && !d.completed)
      .map((d): Deadline => ({ id: d.id, matterId: d.matter.id, title: `${d.title} · ${d.matter.reference}`, dueAt: d.dueAt, priority: Date.parse(d.dueAt) - now.getTime() <= 2 * DAY ? 'URGENT' : 'NORMAL', status: 'OPEN', source: 'USER_ENTERED' }))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    overdueFeeItems: s.finance.reduce((n, { workflow }) => n + overdueInstallments(workflow, today), 0),
    outstandingFees: s.finance.reduce((n, { workflow }) => n + Math.max(0, workflow.agreedFees - paidTotal(workflow)), 0),
    recentActivity: [
      ...s.events.flatMap((e): DashboardActivity[] => { const m = byId.get(e.matterId); return m ? [{ id: `event-${e.id}`, officeId: m.officeId, kind: 'MATTER', title: m.title, detail: e.title, happenedAt: e.date }] : []; }),
      ...s.finance.flatMap(({ matter: m, workflow: w }) => w.activity.map((a, i): DashboardActivity => ({ id: `${m.id}-${i}`, officeId: m.officeId, kind: 'MATTER', title: m.title, detail: a.title, happenedAt: a.date }))),
    ].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt)).slice(0, 8),
  };
}
