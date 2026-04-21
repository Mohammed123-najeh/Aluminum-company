import React, { useState, useEffect, startTransition, useCallback } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useApp } from '../contexts/AppContext';
import { StatsCards } from '../components/admin/StatsCards';
import { UserTable } from '../components/admin/UserTable';
import { OrgChart } from '../components/admin/OrgChart';
import { UserModal } from '../components/admin/UserModal';
import { SettingsModal } from '../components/admin/SettingsModal';
import { SectionPanel } from '../components/SectionPanel';
import { AiAssistantPanel } from '../components/ai/AiAssistantPanel';
import { AdminMessages } from '../components/admin/AdminMessages';
import { AdminAnalytics } from '../components/admin/AdminAnalytics';
import { AdminFinancialAnalytics } from '../components/admin/AdminFinancialAnalytics';
import { AdminApprovalCenter } from '../components/admin/AdminApprovalCenter';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { NotificationsPanel } from '../components/notifications/NotificationsPanel';
import { useNotifications } from '../hooks/useNotifications';
import { useMessages } from '../hooks/useMessages';
import type { User, CreateUserInput, UpdateUserInput } from '../types/user';
import { adminApprovalsApi } from '../services/api';

type View = 'users' | 'orgchart' | 'analytics' | 'financial' | 'approvals' | 'messages' | 'assistant' | 'notifications';

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
    {badge !== undefined && (
      <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'}`}>
        {badge}
      </span>
    )}
  </button>
);

type Props = {
  onLogout: () => void;
  initialAiShareToken?: string | null;
  onAiShareConsumed?: () => void;
};

export const AdminPage: React.FC<Props> = ({ onLogout, initialAiShareToken, onAiShareConsumed }) => {
  const { t, theme, toggleTheme, adminProfile, token } = useApp();
  const notif = useNotifications(token);
  const [view, setView] = useState<View>(() => (initialAiShareToken ? 'assistant' : 'users'));
  const [now, setNow] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [approvalPendingTotal, setApprovalPendingTotal] = useState(0);

  const { users, loading: usersLoading, error: usersError, createUser, updateUser, deleteUser, toggleStatus, assignSupervisor } = useUsers();
  const [selectedMessagePeerId, setSelectedMessagePeerId] = useState<string | null>(null);
  const internalMessages = useMessages(selectedMessagePeerId);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    adminApprovalsApi
      .summary(token)
      .then((s) => {
        if (!cancelled) setApprovalPendingTotal(s.pendingSalaryRequests + s.pendingSubmissions);
      })
      .catch(() => {
        if (!cancelled) setApprovalPendingTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [token, view]);

  const handleCreate = async (input: CreateUserInput) => {
    await createUser(input);
    setShowCreate(false);
  };

  const handleUpdate = async (input: UpdateUserInput) => {
    if (editUser) {
      await updateUser(editUser.id, input);
      setEditUser(null);
    }
  };

  const nonAdminUsers = users.filter((u) => u.role !== 'admin');
  const supervisorCount = users.filter((u) => u.role === 'supervisor').length;
  const employeeCount = users.filter((u) => u.role === 'employee').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const initials = adminProfile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const goView = (v: View) => startTransition(() => setView(v));

  const openMessagesWithPeer = (peerUserId: string) => {
    goView('messages');
    setSelectedMessagePeerId(peerUserId);
  };

  const refreshApprovalCounts = useCallback(() => {
    if (!token) return;
    adminApprovalsApi
      .summary(token)
      .then((s) => setApprovalPendingTotal(s.pendingSalaryRequests + s.pendingSubmissions))
      .catch(() => {});
  }, [token]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* ── Sidebar ── */}
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 dark:bg-slate-950">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-blue-600 shadow-lg shadow-indigo-500/30">
            <span className="text-[11px] font-black tracking-tight text-white">AF</span>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('aluminumFactory')}</p>
            <p className="text-sm font-semibold text-white leading-tight">{t('adminPanel')}</p>
          </div>
        </div>

        {/* Nav — scroll so Settings / Logout at bottom stay reachable on short screens */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">{t('management')}</p>
          <NavItem
            label={t('userManagement')}
            active={view === 'users'}
            onClick={() => goView('users')}
            badge={nonAdminUsers.length}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
          />
          <NavItem
            label={t('orgChart')}
            active={view === 'orgchart'}
            onClick={() => goView('orgchart')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            }
          />
          <NavItem
            label={t('adminAnalytics')}
            active={view === 'analytics'}
            onClick={() => goView('analytics')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v7.125C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />

          <div className="my-3 border-t border-slate-800" />
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">{t('adminSidebarFinanceSection')}</p>
          <NavItem
            label={t('adminProfitReceiptsNav')}
            active={view === 'financial'}
            onClick={() => goView('financial')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m0-12.75H21m-4.5 3.75h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M18 10.5h.008v.008H18V10.5z"
                />
              </svg>
            }
          />

          <NavItem
            label={t('adminApprovalsNav')}
            active={view === 'approvals'}
            onClick={() => goView('approvals')}
            badge={approvalPendingTotal > 0 ? approvalPendingTotal : undefined}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
            }
          />

          <NavItem
            label={t('messages')}
            active={view === 'messages'}
            onClick={() => goView('messages')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            }
          />
          <NavItem
            label={t('aiAssistantNav')}
            active={view === 'assistant'}
            onClick={() => goView('assistant')}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m9 3a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M9.75 21h-4.5a2.25 2.25 0 01-2.25-2.25v-12a2.25 2.25 0 012.25-2.25h4.5a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25zm3.75-9v-.75a2.25 2.25 0 00-2.25-2.25H15" />
              </svg>
            }
          />
          <NavItem
            label={t('notificationsNav')}
            active={view === 'notifications'}
            onClick={() => goView('notifications')}
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

          <div className="my-3 border-t border-slate-800" />
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">{t('overview')}</p>

          <div className="rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('supervisorsLabel')}</span>
              <span className="font-semibold text-indigo-400">{supervisorCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('employeesLabel')}</span>
              <span className="font-semibold text-orange-400">{employeeCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('suspendedLabel')}</span>
              <span className="font-semibold text-red-400">{suspendedCount}</span>
            </div>
          </div>
        </nav>

        {/* Bottom: Settings + Admin — shrink-0 keeps logout above the fold when nav scrolls */}
        <div className="shrink-0 border-t border-slate-800 px-3 py-3 space-y-1">
          <NavItem
            label={t('settings')}
            active={showSettings}
            onClick={() => setShowSettings(true)}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />

          {/* Logout */}
          <button
            onClick={onLogout}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-950/40 hover:text-red-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>{t('logout')}</span>
          </button>

          {/* Admin profile chip */}
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{adminProfile.name}</p>
              <p className="text-[10px] text-slate-500">{t('administrator')}</p>
            </div>
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {view === 'users' && t('userManagement')}
              {view === 'orgchart' && t('orgChart')}
              {view === 'analytics' && t('adminAnalytics')}
              {view === 'financial' && t('adminFinancialDashboardTitle')}
              {view === 'approvals' && t('adminApprovalsTitle')}
              {view === 'messages' && t('messages')}
              {view === 'assistant' && t('aiAssistantNav')}
              {view === 'notifications' && t('notificationsTitle')}
            </h1>
            <p className="mt-px text-xs text-slate-400 dark:text-slate-500">
              <span className="font-medium text-slate-600 dark:text-slate-300">{dateStr}</span>
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              <span className="font-mono">{timeStr}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell
              state={notif}
              onViewAll={() => goView('notifications')}
              onOpenMessagesWithPeer={openMessagesWithPeer}
            />
            <button
              type="button"
              onClick={onLogout}
              title={t('logout')}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
            {/* Tab switcher */}
            <div className="hidden sm:flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => goView('users')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'users'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('users')}
              </button>
              <button
                type="button"
                onClick={() => goView('orgchart')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'orgchart'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('orgChart')}
              </button>
              <button
                type="button"
                onClick={() => goView('analytics')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'analytics'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('adminAnalytics')}
              </button>
              <button
                type="button"
                onClick={() => goView('financial')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'financial'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('adminProfitReceiptsNav')}
              </button>
              <button
                type="button"
                onClick={() => goView('approvals')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'approvals'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('adminApprovalsNav')}
              </button>
              <button
                type="button"
                onClick={() => goView('messages')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'messages'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('messages')}
              </button>
              <button
                type="button"
                onClick={() => goView('assistant')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'assistant'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('aiAssistantNav')}
              </button>
              <button
                type="button"
                onClick={() => goView('notifications')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === 'notifications'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('notificationsNav')}
              </button>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
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

            {/* Create Account */}
            <button
              onClick={() => setShowCreate(true)}
              className={`inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-blue-500 ${view === 'assistant' || view === 'notifications' || view === 'messages' || view === 'analytics' || view === 'financial' || view === 'approvals' ? 'hidden' : ''}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('createAccount')}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 space-y-5">
          {view === 'notifications' ? (
            <NotificationsPanel state={notif} onOpenMessagesWithPeer={openMessagesWithPeer} />
          ) : view === 'analytics' ? (
            <AdminAnalytics />
          ) : view === 'financial' ? (
            <AdminFinancialAnalytics />
          ) : view === 'approvals' ? (
            <AdminApprovalCenter onCountsMayHaveChanged={refreshApprovalCounts} />
          ) : usersLoading ? (
            <div className="flex items-center justify-center py-20">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
            </div>
          ) : usersError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {usersError}
            </div>
          ) : (
            <>
              {(view === 'users' || view === 'orgchart') && <StatsCards users={users} />}
              <SectionPanel active={view === 'users'}>
                <UserTable users={users} onEdit={setEditUser} onToggleStatus={toggleStatus} onDelete={deleteUser} />
              </SectionPanel>
              <SectionPanel active={view === 'orgchart'}>
                <OrgChart users={users} onAssign={assignSupervisor} onEdit={setEditUser} />
              </SectionPanel>
              <SectionPanel active={view === 'messages'}>
                <AdminMessages
                  staff={nonAdminUsers}
                  selectedReceiverId={selectedMessagePeerId}
                  onSelectReceiver={setSelectedMessagePeerId}
                  thread={internalMessages.thread}
                  threadLoading={internalMessages.threadLoading}
                  threadError={internalMessages.threadError}
                  threadSummaries={internalMessages.threadSummaries}
                  summariesLoading={internalMessages.summariesLoading}
                  sendMessage={internalMessages.sendMessage}
                />
              </SectionPanel>
              <SectionPanel active={view === 'assistant'}>
                <AiAssistantPanel
                  viewerRole="admin"
                  initialShareToken={initialAiShareToken}
                  onShareConsumed={onAiShareConsumed}
                />
              </SectionPanel>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {(showCreate || editUser) && (
        <UserModal
          users={users}
          editUser={editUser}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onClose={() => { setShowCreate(false); setEditUser(null); }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};
