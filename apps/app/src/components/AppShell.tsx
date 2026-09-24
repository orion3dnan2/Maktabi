import { Bell, CalendarDays, FolderKanban, Home, Menu, UsersRound } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Dashboard } from './Dashboard';

const nav = [{ id: 'home', label: 'الرئيسية', icon: Home }, { id: 'matters', label: 'الملفات', icon: FolderKanban }, { id: 'calendar', label: 'التقويم', icon: CalendarDays }, { id: 'clients', label: 'العملاء', icon: UsersRound }, { id: 'more', label: 'المزيد', icon: Menu }];

export function AppShell() {
  return <div className="app-shell">
    <header className="topbar"><BrandMark compact /><strong>مكتبي</strong><div className="topbar__actions"><button aria-label="الإشعارات"><Bell size={21}/><span /></button><button className="avatar" aria-label="الملف الشخصي">م أ</button></div></header>
    <Dashboard />
    <nav className="bottom-nav" aria-label="التنقل الرئيسي">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={id === 'home' ? 'is-active' : ''} aria-current={id === 'home' ? 'page' : undefined} onClick={() => id !== 'home' && alert(`${label} — ستتوفر في الدفعة القادمة`)}><Icon size={21}/><span>{label}</span></button>)}</nav>
  </div>;
}
