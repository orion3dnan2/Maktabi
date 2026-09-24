import type { DashboardRepository, DashboardSnapshot } from '@maktabi/domain';

const snapshot: DashboardSnapshot = {
  currentUser: { id: 'u-1', fullName: 'محمد أحمد', role: 'owner', officeName: 'مكتب العدالة للمحاماة' },
  todaysSessions: [
    { id: 's-1', matterId: 'm-1', matterTitle: 'أحمد محمد × شركة النيل', court: 'محكمة الخرطوم الجزئية', room: 'قاعة ٢', startsAt: '2026-09-24T10:30:00Z', status: 'scheduled' },
    { id: 's-2', matterId: 'm-2', matterTitle: 'مطالبة عمالية — سارة علي', court: 'محكمة العمل', startsAt: '2026-09-24T12:00:00Z', status: 'scheduled' },
    { id: 's-3', matterId: 'm-3', matterTitle: 'شركة الأفق × حسن عمر', court: 'المحكمة التجارية', startsAt: '2026-09-24T14:15:00Z', status: 'scheduled' },
  ],
  upcomingDeadlines: [
    { id: 'd-1', matterId: 'm-4', title: 'إيداع مذكرة الاستئناف', dueAt: '2026-09-27T13:00:00Z', priority: 'urgent' },
    { id: 'd-2', matterId: 'm-2', title: 'الرد على مذكرة الدفاع', dueAt: '2026-09-30T13:00:00Z', priority: 'normal' },
  ],
  activeMatters: 24,
  outstandingFees: 4850000,
  outstandingInvoices: 3,
  recentActivity: [
    { id: 'a-1', label: 'تم تحديث الملف ١٢٣/٢٠٢٦', detail: 'أضيف محضر الجلسة', happenedAt: '2026-09-24T08:15:00Z', kind: 'matter' },
    { id: 'a-2', label: 'تمت إضافة موكل جديد', detail: 'شركة الندى التجارية', happenedAt: '2026-09-23T15:20:00Z', kind: 'client' },
    { id: 'a-3', label: 'تم تسجيل دفعة', detail: 'ملف ٩٨/٢٠٢٦ · ٣٥٠,٠٠٠ ج.س', happenedAt: '2026-09-23T11:40:00Z', kind: 'payment' },
  ],
};

export const mockDashboardRepository: DashboardRepository = {
  async getSnapshot() {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return structuredClone(snapshot);
  },
};
