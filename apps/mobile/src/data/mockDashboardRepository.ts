import type { DashboardRepository, DashboardSnapshot } from '@maktabi/domain';
/** Sample timestamps relative to today, in office time (Khartoum, UTC+2), so the demo always looks current. */
const at = (dayOffset: number, hour: number, minute = 0): string => {
  const date = new Date(); date.setUTCHours(hour - 2, minute, 0, 0); date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString();
};
const buildSnapshot = (): DashboardSnapshot => ({
  currentUser: { id: 'user-1', officeId: 'office-1', fullName: 'محمد أحمد', role: 'OWNER', isActive: true },
  office: { id: 'office-1', name: 'مكتب العدالة للمحاماة', defaultCurrency: 'SDG' },
  todaysSessions: [
    { id: 's1', matterId: 'm1', title: 'أحمد محمد ضد شركة النيل', authority: 'محكمة افتراضية — بيانات تجريبية', room: 'قاعة ٢', startsAt: at(0, 10, 30), status: 'SCHEDULED' },
    { id: 's2', matterId: 'm2', title: 'مطالبة عمالية تجريبية', authority: 'جهة قضائية افتراضية', startsAt: at(0, 12), status: 'SCHEDULED' },
  ],
  upcomingDeadlines: [
    { id: 'd1', matterId: 'm3', title: 'موعد إيداع مذكرة — تجريبي', dueAt: at(3, 15), priority: 'URGENT', status: 'OPEN', source: 'USER_ENTERED' },
    { id: 'd2', matterId: 'm2', title: 'متابعة مستندات الموكل', dueAt: at(6, 15), priority: 'NORMAL', status: 'OPEN', source: 'USER_ENTERED' },
  ],
  activeMatters: 24,
  outstandingFees: { amountMinor: 485000000, currency: 'SDG' },
  overdueFeeItems: 3,
  recentActivity: [
    { id: 'a1', officeId: 'office-1', kind: 'MATTER', title: 'تم تحديث ملف تجريبي', detail: 'أضيف محضر الجلسة', happenedAt: at(0, 8, 15) },
    { id: 'a2', officeId: 'office-1', kind: 'CLIENT', title: 'تمت إضافة موكل تجريبي', detail: 'شركة الندى الافتراضية', happenedAt: at(-1, 17, 20) },
    { id: 'a3', officeId: 'office-1', kind: 'PAYMENT', title: 'تم تسجيل دفعة تجريبية', detail: '٣٥٠٬٠٠٠ ج.س', happenedAt: at(-1, 13, 40) },
  ],
});
export class MockDashboardRepository implements DashboardRepository { async getSnapshot(): Promise<DashboardSnapshot> { await new Promise((resolve) => setTimeout(resolve, 180)); return buildSnapshot(); } }
export const dashboardRepository: DashboardRepository = new MockDashboardRepository();
