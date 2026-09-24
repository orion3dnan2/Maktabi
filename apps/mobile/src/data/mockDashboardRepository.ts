import type { DashboardRepository, DashboardSnapshot } from '@maktabi/domain';
const snapshot: DashboardSnapshot = {
  currentUser: { id: 'user-1', officeId: 'office-1', fullName: 'محمد أحمد', role: 'OWNER', isActive: true },
  office: { id: 'office-1', name: 'مكتب العدالة للمحاماة', defaultCurrency: 'SDG' },
  todaysSessions: [
    { id: 's1', matterId: 'm1', title: 'أحمد محمد ضد شركة النيل', authority: 'محكمة افتراضية — بيانات تجريبية', room: 'قاعة ٢', startsAt: '2026-09-24T10:30:00Z', status: 'SCHEDULED' },
    { id: 's2', matterId: 'm2', title: 'مطالبة عمالية تجريبية', authority: 'جهة قضائية افتراضية', startsAt: '2026-09-24T12:00:00Z', status: 'SCHEDULED' },
  ],
  upcomingDeadlines: [
    { id: 'd1', matterId: 'm3', title: 'موعد إيداع مذكرة — تجريبي', dueAt: '2026-09-27T13:00:00Z', priority: 'URGENT', status: 'OPEN', source: 'USER_ENTERED' },
    { id: 'd2', matterId: 'm2', title: 'متابعة مستندات الموكل', dueAt: '2026-09-30T13:00:00Z', priority: 'NORMAL', status: 'OPEN', source: 'USER_ENTERED' },
  ],
  activeMatters: 24,
  outstandingFees: { amountMinor: 485000000, currency: 'SDG' },
  overdueFeeItems: 3,
  recentActivity: [
    { id: 'a1', officeId: 'office-1', kind: 'MATTER', title: 'تم تحديث ملف تجريبي', detail: 'أضيف محضر الجلسة', happenedAt: '2026-09-24T08:15:00Z' },
    { id: 'a2', officeId: 'office-1', kind: 'CLIENT', title: 'تمت إضافة موكل تجريبي', detail: 'شركة الندى الافتراضية', happenedAt: '2026-09-23T15:20:00Z' },
    { id: 'a3', officeId: 'office-1', kind: 'PAYMENT', title: 'تم تسجيل دفعة تجريبية', detail: '٣٥٠٬٠٠٠ ج.س', happenedAt: '2026-09-23T11:40:00Z' },
  ],
};
export class MockDashboardRepository implements DashboardRepository { async getSnapshot(): Promise<DashboardSnapshot> { await new Promise((resolve) => setTimeout(resolve, 180)); return JSON.parse(JSON.stringify(snapshot)) as DashboardSnapshot; } }
export const dashboardRepository: DashboardRepository = new MockDashboardRepository();
