import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Banknote, CalendarClock, Camera, FilePlus2, FolderKanban, Plus, Search, UserPlus, UsersRound } from 'lucide-react';
import { Badge, Card } from '@maktabi/ui';
import type { DashboardSnapshot } from '@maktabi/domain';
import { mockDashboardRepository } from '../data/mockDashboard';

const arTime = new Intl.DateTimeFormat('ar-SD', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
const arMoney = new Intl.NumberFormat('ar-SD', { maximumFractionDigits: 0 });

export function Dashboard() {
  const [data, setData] = useState<DashboardSnapshot>();
  const [query, setQuery] = useState('');
  useEffect(() => { void mockDashboardRepository.getSnapshot().then(setData); }, []);
  const activities = useMemo(() => data?.recentActivity.filter((item) => `${item.label} ${item.detail}`.includes(query)) ?? [], [data, query]);
  if (!data) return <main className="dashboard dashboard--loading" aria-busy="true"><div/><div/><div/></main>;
  const firstName = data.currentUser.fullName.split(' ')[0];
  return <main className="dashboard">
    <section className="welcome"><p>صباح الخير، {firstName}</p><h1>{data.currentUser.officeName}</h1><label className="search"><Search size={20}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في الملفات والعملاء والمستندات" aria-label="البحث الشامل"/><kbd>⌘ K</kbd></label></section>

    <section className="dashboard-grid">
      <Card className="sessions panel panel--wide"><PanelTitle icon={<CalendarClock/>} title="جلسات اليوم" action={`${data.todaysSessions.length} جلسات`} />
        <div className="session-list">{data.todaysSessions.map((session) => <button className="session" key={session.id}><time>{arTime.format(new Date(session.startsAt))}</time><span><strong>{session.matterTitle}</strong><small>{session.court}{session.room ? ` · ${session.room}` : ''}</small></span><ArrowLeft size={18}/></button>)}</div>
      </Card>

      <Card className="deadlines panel"><PanelTitle icon={<CalendarClock/>} title="المواعيد المهمة" action="عرض الكل" />
        {data.upcomingDeadlines.map((deadline, i) => <button className="deadline" key={deadline.id}><span className="deadline__date"><b>{27 + i * 3}</b><small>سبتمبر</small></span><span><strong>{deadline.title}</strong><small>ملف رقم {deadline.matterId.replace('m-', '')} · {i ? 'متبقي ٦ أيام' : 'متبقي ٣ أيام'}</small></span>{deadline.priority === 'urgent' && <Badge tone="danger">عاجل</Badge>}</button>)}
      </Card>

      <section className="metrics" aria-label="ملخص المكتب"><Card className="metric"><span className="metric__icon"><FolderKanban/></span><div><small>الملفات النشطة</small><strong>{data.activeMatters}</strong><p>٣ ملفات بانتظار إجراء</p></div></Card><Card className="metric"><span className="metric__icon metric__icon--gold"><Banknote/></span><div><small>الأتعاب المستحقة</small><strong>{arMoney.format(data.outstandingFees)} <em>ج.س</em></strong><p>{data.outstandingInvoices} فواتير متأخرة</p></div></Card></section>

      <Card className="quick panel"><PanelTitle icon={<Plus/>} title="إجراءات سريعة"/><div className="quick__grid"><Quick icon={<FilePlus2/>} label="ملف جديد"/><Quick icon={<UserPlus/>} label="عميل جديد"/><Quick icon={<Camera/>} label="مسح مستند"/><Quick icon={<CalendarClock/>} label="إضافة جلسة"/></div></Card>

      <Card className="activity panel"><PanelTitle icon={<UsersRound/>} title="آخر النشاطات" action="عرض السجل"/>
        <div className="activity__list">{activities.length ? activities.map((item) => <div className="activity__item" key={item.id}><span/><div><strong>{item.label}</strong><small>{item.detail}</small></div><time>منذ ساعتين</time></div>) : <p className="empty">لا توجد نتائج مطابقة لبحثك</p>}</div>
      </Card>
    </section>
  </main>;
}

function PanelTitle({ icon, title, action }: { icon: React.ReactNode; title: string; action?: string }) { return <header className="panel__title"><span>{icon}<h2>{title}</h2></span>{action && <button>{action}</button>}</header>; }
function Quick({ icon, label }: { icon: React.ReactNode; label: string }) { return <button onClick={() => alert(`${label} — ستتوفر قريباً`)}><span>{icon}</span>{label}</button>; }
