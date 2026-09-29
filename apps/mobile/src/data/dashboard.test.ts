import { describe, expect, it } from 'vitest';
import { summarizeDashboard } from './dashboard';
import { emptyWorkflow, type MatterWorkflow } from './workflow';
import { serverMatter } from '../test/fakeMatters';

const now = new Date('2026-10-10T08:00:00');
const at = (day: string, time = '10:00') => new Date(`2026-10-${day}T${time}:00`).toISOString();
const workflow = (patch: Partial<MatterWorkflow>): MatterWorkflow => ({ ...emptyWorkflow(), ...patch });

describe('dashboard summary', () => {
  it('counts server records and summarizes device workflows of active matters', () => {
    const active = { ...serverMatter('a'), nextEventAt: at('10') };
    const closed = { ...serverMatter('c'), status: 'CLOSED' as const };
    const data = summarizeDashboard(7, [
      { matter: active, workflow: workflow({
        appointments: [{ id: 's1', title: 'جلسة اليوم', startsAt: at('10'), status: 'SCHEDULED' }, { id: 's2', title: 'غداً', startsAt: at('11'), status: 'SCHEDULED' }],
        deadlines: [{ id: 'd2', title: 'بعيدة', dueAt: at('30'), source: 'x', completed: false }, { id: 'd1', title: 'قريبة', dueAt: at('11'), source: 'x', completed: false }, { id: 'd0', title: 'منجزة', dueAt: at('01'), source: 'x', completed: true }],
        agreedFees: 30000, installments: [{ id: 'i1', title: 'أول', amount: 10000, dueDate: '2026-10-01' }, { id: 'i2', title: 'ثان', amount: 20000, dueDate: '2026-12-01' }],
        receipts: [{ id: 'r', number: 'RC-1', amount: 4000, date: at('02'), method: 'نقدي' }],
        activity: [{ title: 'أحدث', date: at('09') }],
      }) },
      { matter: closed, workflow: workflow({ appointments: [{ id: 'x', title: 'قضية مغلقة', startsAt: at('10'), status: 'SCHEDULED' }], agreedFees: 5000, activity: [{ title: 'أقدم', date: at('01') }] }) },
    ], now);
    expect(data).toMatchObject({ clients: 7, activeMatters: 1, upcoming: 1, overdueFeeItems: 1, outstandingFees: 31000 });
    expect(data.todaysSessions.map((s) => s.title)).toEqual(['جلسة اليوم']);
    expect(data.upcomingDeadlines.map((d) => [d.id, d.priority])).toEqual([['d1', 'URGENT'], ['d2', 'NORMAL']]);
    expect(data.recentActivity.map((a) => a.detail)).toEqual(['أحدث', 'أقدم']);
  });
  it('shows zeros, not sample data, for an office with nothing recorded', () => {
    expect(summarizeDashboard(0, [], now)).toEqual({ clients: 0, activeMatters: 0, upcoming: 0, todaysSessions: [], upcomingDeadlines: [], overdueFeeItems: 0, outstandingFees: 0, recentActivity: [] });
  });
});
