import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiTask, TaskStatus } from '../../services/api';
import { SupervisorPaymentAnalytics } from './SupervisorPaymentAnalytics';

const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending: 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100',
  in_progress: 'bg-amber-400/90 text-amber-950 dark:bg-amber-500/40 dark:text-amber-100',
  completed: 'bg-emerald-500/90 text-white dark:bg-emerald-500/30 dark:text-emerald-100',
  cancelled: 'bg-red-400/80 text-red-950 dark:bg-red-900/40 dark:text-red-200',
};

const BAR_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-slate-400 dark:bg-slate-500',
  in_progress: 'bg-amber-400 dark:bg-amber-500',
  completed: 'bg-emerald-500 dark:bg-emerald-400',
  cancelled: 'bg-red-400 dark:bg-red-500',
};

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

function completionDuration(task: ApiTask): number | null {
  const start = new Date(task.createdAt).getTime();
  const end = task.completedAt
    ? new Date(task.completedAt).getTime()
    : task.status === 'completed'
      ? new Date(task.updatedAt).getTime()
      : NaN;
  if (task.status !== 'completed' || !Number.isFinite(end)) return null;
  return end - start;
}

function isOverdue(task: ApiTask): boolean {
  if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') return false;
  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59, 999);
  return Date.now() > due.getTime();
}

type Props = {
  employees: User[];
  tasks: ApiTask[];
  loading: boolean;
  error: string | null;
};

export const SupervisorAnalytics: React.FC<Props> = ({ employees, tasks, loading, error }) => {
  const { t } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterEmployee, setFilterEmployee] = useState<string>('');
  const [analyticsTab, setAnalyticsTab] = useState<'tasks' | 'payments'>('tasks');

  const stats = useMemo(() => {
    const completed = tasks.filter((x) => x.status === 'completed').length;
    const inProgress = tasks.filter((x) => x.status === 'in_progress').length;
    const overdue = tasks.filter(isOverdue).length;
    return {
      total: tasks.length,
      completed,
      inProgress,
      overdue,
      pending: tasks.filter((x) => x.status === 'pending').length,
    };
  }, [tasks]);

  const byEmployee = useMemo(() => {
    const map = new Map<
      string,
      {
        user: User;
        tasks: ApiTask[];
        counts: Record<TaskStatus, number>;
      }
    >();

    employees.forEach((u) => {
      map.set(u.id, {
        user: u,
        tasks: [],
        counts: { pending: 0, in_progress: 0, completed: 0, cancelled: 0 },
      });
    });

    tasks.forEach((task) => {
      task.assignees.forEach((a) => {
        const row = map.get(a.id);
        if (!row) return;
        row.tasks.push(task);
        row.counts[task.status] += 1;
      });
    });

    return Array.from(map.values()).sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [employees, tasks]);

  const filteredTableTasks = useMemo(() => {
    let list = [...tasks];
    if (filterEmployee) {
      list = list.filter((task) => task.assignees.some((a) => a.id === filterEmployee));
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [tasks, filterEmployee]);

  const statusLabel = (s: TaskStatus) => t(STATUS_LABELS[s] as Parameters<typeof t>[0]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setAnalyticsTab('tasks')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            analyticsTab === 'tasks'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/80'
          }`}
        >
          {t('analyticsTabTasks')}
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsTab('payments')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            analyticsTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/80'
          }`}
        >
          {t('analyticsTabPayments')}
        </button>
      </div>

      {analyticsTab === 'payments' && <SupervisorPaymentAnalytics />}

      {analyticsTab === 'tasks' && (
        <>
      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: t('analyticsTotalTasks'),
            value: stats.total,
            sub: t('analyticsTotalTasksHint'),
            accent: 'from-indigo-500/20 to-violet-500/10 border-indigo-200/60 dark:border-indigo-500/30',
            icon: (
              <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            ),
          },
          {
            label: t('analyticsCompleted'),
            value: stats.completed,
            sub: t('analyticsCompletedHint'),
            accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-200/60 dark:border-emerald-500/25',
            icon: (
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: t('analyticsInProgress'),
            value: stats.inProgress,
            sub: t('analyticsInProgressHint'),
            accent: 'from-amber-400/25 to-orange-500/10 border-amber-200/60 dark:border-amber-500/25',
            icon: (
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          },
          {
            label: t('analyticsOverdue'),
            value: stats.overdue,
            sub: t('analyticsOverdueHint'),
            accent: 'from-rose-500/20 to-red-500/10 border-rose-200/60 dark:border-rose-500/25',
            icon: (
              <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ),
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${card.accent} dark:from-slate-800/80 dark:to-slate-900/80`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">{card.value}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{card.sub}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/60 shadow-inner dark:bg-slate-800/80">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.95)_100%)] p-1 shadow-sm dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgb(15_23_42/0.9)_0%,rgb(15_23_42/0.98)_100%)]">
        <div className="rounded-xl px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('analyticsByMember')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('analyticsByMemberDesc')}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3">
          {byEmployee.map((row) => {
            const total = row.tasks.length;
            const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
            return (
              <div
                key={row.user.id}
                className="group flex flex-col rounded-xl border border-slate-200/90 bg-white/90 p-4 shadow-sm transition hover:border-indigo-300/60 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-indigo-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/25">
                    {row.user.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{row.user.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.user.email}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {total}
                  </span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="flex h-full w-full">
                    {STATUS_ORDER.map((st) => {
                      const c = row.counts[st];
                      if (c === 0) return null;
                      return (
                        <div
                          key={st}
                          className={`${BAR_COLORS[st]} h-full transition-all`}
                          style={{ width: `${pct(c)}%` }}
                          title={`${statusLabel(st)}: ${c}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {STATUS_ORDER.map((st) =>
                    row.counts[st] > 0 ? (
                      <span key={st}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${BAR_COLORS[st]} align-middle`} /> {statusLabel(st)}: {row.counts[st]}
                      </span>
                    ) : null,
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId((id) => (id === row.user.id ? null : row.user.id))}
                  className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:border-slate-600 dark:text-indigo-400 dark:hover:bg-slate-800"
                >
                  {expandedId === row.user.id ? t('analyticsCollapseTasks') : t('analyticsViewTasks')}
                </button>
                {expandedId === row.user.id && row.tasks.length > 0 && (
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto border-t border-slate-100 pt-2 dark:border-slate-700">
                    {Array.from(new Map(row.tasks.map((tk) => [tk.id, tk])).values()).map((task) => {
                      const dur = completionDuration(task);
                      return (
                        <li key={task.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{task.title}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[task.status]}`}>
                              {statusLabel(task.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
                            {task.status === 'completed' && dur != null && (
                              <span>
                                {t('analyticsCompletionTime')}: {formatDurationMs(dur)}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className={isOverdue(task) ? ' text-rose-600 dark:text-rose-400' : ''}>
                                {task.status === 'completed' && dur != null ? ' · ' : ''}
                                {t('dueDate')}: {task.dueDate}
                                {isOverdue(task) ? ` (${t('analyticsOverdue')})` : ''}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full task table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('analyticsTaskDetail')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('analyticsTaskDetailDesc')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            {t('filterByAssignee')}
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('allAssignees')}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30">
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('taskTitle')}</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('assignees')}</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('statusCol')}</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('analyticsCreated')}</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('dueDate')}</th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{t('analyticsCompletionTime')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    {t('noTasksYet')}
                  </td>
                </tr>
              ) : (
                filteredTableTasks.map((task) => {
                  const dur = completionDuration(task);
                  return (
                    <tr key={task.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700/80">
                      <td className="max-w-[220px] px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <span className="line-clamp-2">{task.title}</span>
                        {task.orderReference && (
                          <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{task.orderReference}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {task.assignees.map((a) => a.name).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[task.status]}`}>
                          {statusLabel(task.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">
                        {new Date(task.createdAt).toLocaleString()}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">
                        {task.dueDate ? (
                          <span className={isOverdue(task) ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>{task.dueDate}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
                        {task.status === 'completed' && dur != null ? (
                          <span className="font-medium tabular-nums">{formatDurationMs(dur)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-600">{t('analyticsFootnote')}</p>
        </>
      )}
    </div>
  );
};
