import type { DashboardRepository, DashboardSnapshot } from '@maktabi/domain';
import { clientRepository, matterRepository, workflowRepository, profileRepository, OFFICE_ID } from './repositories';
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
export class MockDashboardRepository implements DashboardRepository {
  async getSnapshot(): Promise<DashboardSnapshot> {
    const [clients, matters] = await Promise.all([clientRepository.listByOffice(OFFICE_ID), matterRepository.listByOffice(OFFICE_ID)]);
    const [workflows, profiles] = await Promise.all([Promise.all(matters.map(async (matter) => ({ matter, workflow: await workflowRepository.getByMatter(matter.id) }))), Promise.all(clients.map((c) => profileRepository.getByClient(c.id)))]);
    return {
      currentUser: { id: 'user-1', officeId: OFFICE_ID, fullName: 'محمد أحمد', role: 'OWNER', isActive: true },
      office: { id: OFFICE_ID, name: 'مكتبي', defaultCurrency: 'SDG' },
      todaysSessions: workflows.flatMap(({ matter: m, workflow: w }) => m.status !== 'ACTIVE' ? [] : w.appointments.filter((a) => a.status === 'SCHEDULED' && sameDay(a.startsAt)).map((a) => ({ id: a.id, matterId: m.id, title: a.title, authority: m.authority ?? '', startsAt: a.startsAt, status: 'SCHEDULED' as const }))).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      upcomingDeadlines: [], activeMatters: matters.filter((m) => m.status === 'ACTIVE').length,
      outstandingFees: { amountMinor: profiles.reduce((n, p) => n + p.agreedFees - p.paidFees, 0), currency: 'SDG' },
      overdueFeeItems: 0,
      recentActivity: workflows.flatMap(({ matter: m, workflow: w }) => w.activity.map((a, i) => ({ id: `${m.id}-${i}`, officeId: OFFICE_ID, kind: 'MATTER' as const, title: m.title, detail: a.title, happenedAt: a.date }))).sort((a, b) => b.happenedAt.localeCompare(a.happenedAt)).slice(0, 8),
    };
  }
}
export const dashboardRepository: DashboardRepository = new MockDashboardRepository();
