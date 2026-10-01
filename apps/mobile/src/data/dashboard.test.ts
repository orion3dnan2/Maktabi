import { describe, expect, it } from 'vitest';
import { emptySources, summarizeDashboard } from './dashboard';
import type { MatterRef } from './supabase/workflowRepository';
import { emptyWorkflow, type MatterWorkflow } from './workflow';
import { serverMatter } from '../test/fakeMatters';

const now = new Date('2026-10-10T08:00:00');
const at = (day: string, time = '10:00') => new Date(`2026-10-${day}T${time}:00`).toISOString();
const workflow = (patch: Partial<MatterWorkflow>): MatterWorkflow => ({ ...emptyWorkflow(), ...patch });
const ref = (id: string, status: MatterRef['status'] = 'ACTIVE'): MatterRef => ({ id, title: `قضية ${id}`, reference: `REF-${id}`, status });

describe('dashboard summary', () => {
  it('uses server sessions, deadlines and activity, and device fees, for active matters', () => {
    const active = { ...serverMatter('a'), nextEventAt: at('10') };
    const closed = { ...serverMatter('c'), status: 'CLOSED' as const };
    const data = summarizeDashboard({
      clients: 7,
      matters: [active, closed],
      sessions: [
        { id: 's2', title: 'غداً', startsAt: at('11'), status: 'SCHEDULED', kind: 'COURT_SESSION', matter: ref('a') },
        { id: 's1', title: 'جلسة اليوم', startsAt: at('10'), status: 'SCHEDULED', kind: 'COURT_SESSION', matter: ref('a') },
        { id: 'x', title: 'قضية مغلقة', startsAt: at('10'), status: 'SCHEDULED', kind: 'COURT_SESSION', matter: ref('c', 'CLOSED') },
      ],
      deadlines: [
        { id: 'd2', title: 'بعيدة', dueAt: at('30'), source: 'x', completed: false, matter: ref('a') },
        { id: 'd1', title: 'قريبة', dueAt: at('11'), source: 'x', completed: false, matter: ref('a') },
        { id: 'dc', title: 'قضية مغلقة', dueAt: at('11'), source: 'x', completed: false, matter: ref('c', 'CLOSED') },
      ],
      events: [{ id: '1', matterId: 'a', title: 'جدولة موعد: غداً', date: at('09') }, { id: '2', matterId: 'unknown', title: 'غير مرئية', date: at('09', '11:00') }],
      finance: [
        { matter: active, workflow: workflow({
          agreedFees: 30000, installments: [{ id: 'i1', title: 'أول', amount: 10000, dueDate: '2026-10-01' }, { id: 'i2', title: 'ثان', amount: 20000, dueDate: '2026-12-01' }],
          receipts: [{ id: 'r', number: 'RC-1', amount: 4000, date: at('02'), method: 'نقدي' }], activity: [{ title: 'تسجيل دفعة', date: at('08') }],
        }) },
        { matter: closed, workflow: workflow({ agreedFees: 5000, activity: [{ title: 'أقدم', date: at('01') }] }) },
      ],
    }, now);
    expect(data).toMatchObject({ clients: 7, activeMatters: 1, upcoming: 1, overdueFeeItems: 1, outstandingFees: 31000 });
    expect(data.todaysSessions.map((s) => [s.title, s.authority])).toEqual([['جلسة اليوم', 'جهة اختبار']]);
    expect(data.upcomingDeadlines.map((d) => [d.id, d.priority, d.title])).toEqual([['d1', 'URGENT', 'قريبة · REF-a'], ['d2', 'NORMAL', 'بعيدة · REF-a']]);
    // Events of matters not in the list are not shown; server and device activity are merged, newest first.
    expect(data.recentActivity.map((a) => a.detail)).toEqual(['جدولة موعد: غداً', 'تسجيل دفعة', 'أقدم']);
  });
  it('shows zeros, not sample data, for an office with nothing recorded', () => {
    expect(summarizeDashboard(emptySources(0), now)).toEqual({ clients: 0, activeMatters: 0, upcoming: 0, todaysSessions: [], upcomingDeadlines: [], overdueFeeItems: 0, outstandingFees: 0, recentActivity: [] });
  });
});
