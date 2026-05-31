import React, { useState, startTransition } from 'react';
import { useApp } from '../contexts/AppContext';
import { useMyEmployees } from '../hooks/useMyEmployees';
import { useMessages } from '../hooks/useMessages';
import { useOrders } from '../hooks/useOrders';
import { useTasks } from '../hooks/useTasks';
import type { User } from '../types/user';
import { SupervisorEmployeeModal } from '../components/supervisor/SupervisorEmployeeModal';
import { SupervisorTeamTable } from '../components/supervisor/SupervisorTeamTable';
import { SupervisorMessages } from '../components/supervisor/SupervisorMessages';
import { SupervisorTasks } from '../components/supervisor/SupervisorTasks';
import { EmployeeInventory } from '../components/employee/EmployeeInventory';
import { SupervisorAnalytics } from '../components/supervisor/SupervisorAnalytics';
import { SupervisorDashboard } from '../components/supervisor/SupervisorDashboard';
import { SupervisorOrders } from '../components/supervisor/SupervisorOrders';
import { SupervisorClients } from '../components/supervisor/SupervisorClients';
import { EmployeeSalesReceipts } from '../components/employee/EmployeeSalesReceipts';
import { SettingsModal } from '../components/admin/SettingsModal';
import { SectionPanel } from '../components/SectionPanel';
import { AiAssistantPanel } from '../components/ai/AiAssistantPanel';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { WorkClockBadge } from '../components/shared/WorkClockBadge';
import { NotificationsPanel } from '../components/notifications/NotificationsPanel';
import { useNotifications } from '../hooks/useNotifications';

type Section =
  | 'home'
  | 'team'
  | 'messages'
  | 'tasks'
  | 'clients'
  | 'analytics'
  | 'orders'
  | 'receipts'
  | 'inventory'
  | 'assistant'
  | 'notifications'
  | 'settings';

const NavItem: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: number;
}> = ({ label, active, onClick, icon, badge }) => (
  <button
    onClick={onClick}
    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
    }`}
  >
    <span className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}>{icon}</span>
    <span className="flex-1 text-start">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span
        className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
          active ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
        }`}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

type Props = {
  onLogout: () => void;
  initialAiShareToken?: string | null;
  onAiShareConsumed?: () => void;
};

export const SupervisorPage: React.FC<Props> = ({ onLogout, initialAiShareToken, onAiShareConsumed }) => {
  const { t, theme, toggleTheme, adminProfile, token } = useApp();
  const notif = useNotifications(token);
  const [section, setSection] = useState<Section>(() => (initialAiShareToken ? 'assistant' : 'home'));
  const [editEmployee, setEditEmployee] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { employees, loading: teamLoading, error: teamError, updateEmployee, toggleStatus } = useMyEmployees();
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  const messages = useMessages(selectedReceiverId);
  const { tasks, loading: tasksLoading, error: tasksError, createTask, updateTask, deleteTask, refetch: refetchTasks } = useTasks();
  const { orders, loading: ordersLoading, error: ordersError } = useOrders();

  const initials = adminProfile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleUpdateEmployee = async (id: string, input: Parameters<typeof updateEmployee>[1]) => {
    await updateEmployee(id, input);
    setEditEmployee(null);
  };

  const go = (s: Section) => startTransition(() => setSection(s));

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 dark:bg-slate-950">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-blue-600 shadow-lg shadow-indigo-500/30">
            <span className="text-[11px] font-black tracking-tight text-white">AF</span>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('aluminumFactory')}</p>
            <p className="text-sm font-semibold leading-tight text-white">{t('supervisorPanel')}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavItem
            label={t('supervisorHome')}
            active={section === 'home'}
            onClick={() => go('home')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            }
          />
          <NavItem
            label={t('myTeam')}
            active={section === 'team'}
            onClick={() => go('team')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
          />
          <NavItem
            label={t('messages')}
            active={section === 'messages'}
            onClick={() => go('messages')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            }
          />
          <NavItem
            label={t('tasks')}
            active={section === 'tasks'}
            onClick={() => go('tasks')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            }
          />
          <NavItem
            label={t('supervisorClientsNav')}
            active={section === 'clients'}
            onClick={() => go('clients')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
          />
          <NavItem
            label={t('teamAnalytics')}
            active={section === 'analytics'}
            onClick={() => go('analytics')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v7.125C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <NavItem
            label={t('orders')}
            active={section === 'orders'}
            onClick={() => go('orders')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            }
          />
          <NavItem
            label={t('navReceipts')}
            active={section === 'receipts'}
            onClick={() => go('receipts')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            }
          />
          <NavItem
            label={t('inventory')}
            active={section === 'inventory'}
            onClick={() => go('inventory')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            }
          />
          <NavItem
            label={t('aiAssistantNav')}
            active={section === 'assistant'}
            onClick={() => go('assistant')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m9 3a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M9.75 21h-4.5a2.25 2.25 0 01-2.25-2.25v-12a2.25 2.25 0 012.25-2.25h4.5a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25zm3.75-9v-.75a2.25 2.25 0 00-2.25-2.25H15" />
              </svg>
            }
          />
          <NavItem
            label={t('notificationsNav')}
            active={section === 'notifications'}
            onClick={() => go('notifications')}
            badge={notif.unreadCount}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.109V8.25c0-2.485-1.008-4.736-2.64-6.364M15.75 14.25a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h.008v.008H15.75V14.25z"
                />
              </svg>
            }
          />
        </nav>

        <div className="border-t border-slate-800 px-3 py-3 space-y-1">
          <NavItem
            label={t('settings')}
            active={section === 'settings'}
            onClick={() => { startTransition(() => { setSection('settings'); setShowSettings(true); }); }}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <button
            onClick={onLogout}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-950/40 hover:text-red-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>{t('logout')}</span>
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{adminProfile.name}</p>
              <p className="text-[10px] text-slate-500">{t('supervisor')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {section === 'home' && t('supervisorHome')}
            {section === 'team' && t('myTeam')}
            {section === 'messages' && t('messages')}
            {section === 'tasks' && t('tasks')}
            {section === 'clients' && t('supervisorClientsNav')}
            {section === 'analytics' && t('teamAnalytics')}
            {section === 'orders' && t('orders')}
            {section === 'receipts' && t('navReceipts')}
            {section === 'inventory' && t('inventory')}
            {section === 'assistant' && t('aiAssistantNav')}
            {section === 'notifications' && t('notificationsTitle')}
            {section === 'settings' && t('settings')}
          </h1>
          <div className="flex items-center gap-2">
            <WorkClockBadge />
            <NotificationBell
              state={notif}
              onOpenMessagesWithPeer={(peerId) => {
                setSelectedReceiverId(peerId);
                go('messages');
              }}
              onOpenTasks={() => go('tasks')}
              onViewAll={() => go('notifications')}
            />
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {theme === 'dark' ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <SectionPanel active={section === 'home'}>
            <SupervisorDashboard
              tasks={tasks}
              orders={orders}
              ordersLoading={ordersLoading}
              onGoSection={(s) => {
                if (s === 'tasks') go('tasks');
                else if (s === 'messages') go('messages');
                else if (s === 'orders') go('orders');
                else if (s === 'inventory') go('inventory');
              }}
            />
          </SectionPanel>
          <SectionPanel active={section === 'team'}>
            <SupervisorTeamTable
              employees={employees}
              loading={teamLoading}
              error={teamError}
              onEdit={setEditEmployee}
              onToggleStatus={toggleStatus}
              onMessage={(id) => {
                setSelectedReceiverId(id);
                startTransition(() => setSection('messages'));
              }}
              onAssignTask={() => startTransition(() => setSection('tasks'))}
            />
          </SectionPanel>
          <SectionPanel active={section === 'messages'}>
            <SupervisorMessages
              employees={employees}
              tasks={tasks}
              selectedReceiverId={selectedReceiverId}
              onSelectReceiver={setSelectedReceiverId}
              {...messages}
            />
          </SectionPanel>
          <SectionPanel active={section === 'tasks'}>
            <SupervisorTasks
              employees={employees}
              tasks={tasks}
              loading={tasksLoading}
              error={tasksError}
              onCreateTask={createTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              refetchTasks={refetchTasks}
            />
          </SectionPanel>
          <SectionPanel active={section === 'clients'}>
            <SupervisorClients />
          </SectionPanel>
          <SectionPanel active={section === 'analytics'}>
            <SupervisorAnalytics employees={employees} tasks={tasks} loading={tasksLoading} error={tasksError} />
          </SectionPanel>
          <SectionPanel active={section === 'orders'}>
            <SupervisorOrders orders={orders} loading={ordersLoading} error={ordersError} />
          </SectionPanel>
          <SectionPanel active={section === 'receipts'}>
            <div className="max-w-4xl space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('supervisorReceiptsIntro')}</p>
              <EmployeeSalesReceipts showInnerHeading={false} isActive={section === 'receipts'} />
            </div>
          </SectionPanel>
          <SectionPanel active={section === 'inventory'}>
            <EmployeeInventory />
          </SectionPanel>
          <SectionPanel active={section === 'assistant'}>
            <AiAssistantPanel
              viewerRole="supervisor"
              initialShareToken={initialAiShareToken}
              onShareConsumed={onAiShareConsumed}
            />
          </SectionPanel>
          <SectionPanel active={section === 'notifications'}>
            <NotificationsPanel
              state={notif}
              onOpenMessagesWithPeer={(peerId) => {
                setSelectedReceiverId(peerId);
                go('messages');
              }}
              onOpenTasks={() => go('tasks')}
            />
          </SectionPanel>
          <SectionPanel active={section === 'settings' && !showSettings}>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings')}</p>
          </SectionPanel>
        </main>
      </div>

      {editEmployee && (
        <SupervisorEmployeeModal
          employee={editEmployee}
          onUpdate={handleUpdateEmployee}
          onClose={() => setEditEmployee(null)}
        />
      )}
      {showSettings && (
        <SettingsModal
          onClose={() => {
            startTransition(() => {
              setShowSettings(false);
              setSection('home');
            });
          }}
        />
      )}
    </div>
  );
};
