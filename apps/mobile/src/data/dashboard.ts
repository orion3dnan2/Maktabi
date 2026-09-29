import type { DashboardActivity, Deadline, Matter, Session } from '@maktabi/domain';
import { paidTotal, type MatterWorkflow } from './workflow';

/**
 * Dashboard figures. Client and matter counts come from Supabase; sessions, deadlines, fees and
 * activity come from this device's matter workflows (not synchronized yet), so they cover only
 * what was recorded on this device.
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

const DAY = 86400000;
const sameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString();

function overdueInstallments(w: MatterWorkflow, today: string) {
  let due = 0;
  return [...w.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .filter((i) => { due += i.amount; return i.dueDate < today && due > paidTotal(w); }).length;
}

export function summarizeDashboard(clients: number, entries: { matter: Matter; workflow: MatterWorkflow }[], now = new Date()): DashboardData {
  const active = entries.filter(({ matter }) => matter.status === 'ACTIVE');
  const today = now.toLocaleDateString('en-CA');
  return {
    clients,
    activeMatters: active.length,
    upcoming: active.filter(({ matter }) => matter.nextEventAt).length,
    todaysSessions: active.flatMap(({ matter: m, workflow: w }) => w.appointments
      .filter((a) => a.status === 'SCHEDULED' && sameDay(a.startsAt, now))
      .map((a): Session => ({ id: a.id, matterId: m.id, title: a.title, authority: m.authority ?? '', startsAt: a.startsAt, status: 'SCHEDULED' })))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    upcomingDeadlines: active.flatMap(({ matter: m, workflow: w }) => w.deadlines.filter((d) => !d.completed)
      .map((d): Deadline => ({ id: d.id, matterId: m.id, title: `${d.title} · ${m.reference}`, dueAt: d.dueAt, priority: Date.parse(d.dueAt) - now.getTime() <= 2 * DAY ? 'URGENT' : 'NORMAL', status: 'OPEN', source: 'USER_ENTERED' })))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    overdueFeeItems: entries.reduce((n, { workflow }) => n + overdueInstallments(workflow, today), 0),
    outstandingFees: entries.reduce((n, { workflow }) => n + Math.max(0, workflow.agreedFees - paidTotal(workflow)), 0),
    recentActivity: entries.flatMap(({ matter: m, workflow: w }) => w.activity.map((a, i): DashboardActivity => ({ id: `${m.id}-${i}`, officeId: m.officeId, kind: 'MATTER', title: m.title, detail: a.title, happenedAt: a.date })))
      .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt)).slice(0, 8),
  };
}
