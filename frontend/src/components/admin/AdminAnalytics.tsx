import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import type { TaskStatus } from '../../services/api';

const TASK_STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

const TASK_BAR: Record<TaskStatus, string> = {
  pending: 'bg-slate-400 dark:bg-slate-500',
  in_progress: 'bg-amber-400 dark:bg-amber-500',
  completed: 'bg-emerald-500 dark:bg-emerald-400',
  cancelled: 'bg-red-400 dark:bg-red-500',
};

const TASK_LABEL: Record<TaskStatus, 'taskStatusPending' | 'taskStatusInProgress' | 'taskStatusCompleted' | 'taskStatusCancelled'> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
};

const ORDER_KEYS = ['draft', 'submitted', 'in_progress', 'completed', 'cancelled'] as const;

type OrderStatusKey =
  | 'adminOrderDraft'
  | 'adminOrderSubmitted'
  | 'adminOrderInProgress'
  | 'adminOrderCompleted'
  | 'adminOrderCancelled';

const ORDER_LABEL: Record<(typeof ORDER_KEYS)[number], OrderStatusKey> = {
  draft: 'adminOrderDraft',
  submitted: 'adminOrderSubmitted',
  in_progress: 'adminOrderInProgress',
  completed: 'adminOrderCompleted',
  cancelled: 'adminOrderCancelled',
};

export function MiniStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function DistributionBar({
  segments,
}: {
  segments: { key: string; value: number; className: string; label: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.value / total) * 100}%` }}
            className={`min-w-px ${s.className}`}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {segments.map((s) => (
          <span key={s.key}>
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${s.className}`} />
            {s.label}: {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export const AdminAnalytics: React.FC = () => {
  const { t } = useApp();
  const { data, loading, error, refresh } = useAdminAnalytics();

  const taskSegments = useMemo(() => {
    if (!data) return [];
    return TASK_STATUS_ORDER.map((st) => ({
      key: st,
      value: data.tasks.byStatus[st],
      className: TASK_BAR[st],
      label: t(TASK_LABEL[st]),
    }));
  }, [data, t]);

  const orderSegments = useMemo(() => {
    if (!data) return [];
    const palette = [
      'bg-slate-400 dark:bg-slate-500',
      'bg-amber-400 dark:bg-amber-500',
      'bg-sky-500 dark:bg-sky-400',
      'bg-emerald-500 dark:bg-emerald-400',
      'bg-red-400 dark:bg-red-500',
    ];
    return ORDER_KEYS.map((st, i) => ({
      key: st,
      value: data.orders.byStatus[st] ?? 0,
      className: palette[i % palette.length],
      label: t(ORDER_LABEL[st]),
    }));
  }, [data, t]);

  const employeeTypeRows = useMemo(() => {
    if (!data) return [];
    const u = data.users.employeeTypes;
    return [
      { key: 'acc', label: t('accountant'), value: u.accountant },
      { key: 'sales', label: t('sales'), value: u.sales },
      { key: 'hr', label: t('hr'), value: u.hr },
      { key: 'unset', label: t('adminEmployeeTypeUnset'), value: u.unset },
    ];
  }, [data, t]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const gen = new Date(data.generatedAt).toLocaleString();

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminAnalyticsIntro')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {t('adminAnalyticsLastUpdated')}: {gen}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {loading ? '…' : t('adminAnalyticsRefresh')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <MiniStat
          label={t('adminAnalyticsCardUsers')}
          value={data.users.totalNonAdmin}
          hint={`${data.users.active} ${t('active').toLowerCase()} · ${data.users.suspended} ${t('statusSuspended').toLowerCase()}`}
          accent="text-slate-800 dark:text-slate-100"
        />
        <MiniStat
          label={t('supervisors')}
          value={data.users.supervisors}
          hint={t('adminAnalyticsCardSupervisorsHint')}
          accent="text-indigo-600 dark:text-indigo-400"
        />
        <MiniStat
          label={t('employees')}
          value={data.users.employees}
          hint={
            data.users.employeesWithoutSupervisor > 0
              ? `${data.users.employeesWithoutSupervisor} ${t('adminEmployeesUnassigned')}`
              : t('adminAllEmployeesAssigned')
          }
          accent="text-orange-600 dark:text-orange-400"
        />
        <MiniStat
          label={t('tasks')}
          value={data.tasks.total}
          hint={`${data.tasks.overdue} ${t('analyticsOverdue').toLowerCase()}`}
          accent="text-violet-600 dark:text-violet-400"
        />
        <MiniStat
          label={t('orders')}
          value={data.orders.total}
          hint={t('adminAnalyticsCardOrdersHint')}
          accent="text-sky-600 dark:text-sky-400"
        />
        <MiniStat
          label={t('adminAnalyticsCardMessages')}
          value={data.messages.last7Days}
          hint={`${data.messages.total} ${t('adminAnalyticsTotalMessages')}`}
          accent="text-teal-600 dark:text-teal-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSectionTasks')}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminSectionTasksDesc')}</p>
          <div className="mt-4">
            <DistributionBar segments={taskSegments} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSectionOrders')}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminSectionOrdersDesc')}</p>
          <div className="mt-4">
            {data.orders.total === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('adminNoOrdersYet')}</p>
            ) : (
              <DistributionBar segments={orderSegments} />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSectionEmployeeTypes')}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminSectionEmployeeTypesDesc')}</p>
          <ul className="mt-4 space-y-2">
            {employeeTypeRows.map((row) => (
              <li key={row.key} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSectionStorehouse')}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminSectionStorehouseDesc')}</p>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t('adminInventoryRows')}</span>
              <span className="font-semibold tabular-nums">{data.storehouse.inventoryRows}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t('adminInventoryTotalM')}</span>
              <span className="font-semibold tabular-nums">{data.storehouse.totalQuantityM}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t('adminAiConversations')}</span>
              <span className="font-semibold tabular-nums">{data.ai.conversations}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t('adminAiMessages')}</span>
              <span className="font-semibold tabular-nums">{data.ai.aiMessages}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSectionSupervisorTeams')}</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminSectionSupervisorTeamsDesc')}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 pr-3">{t('supervisors')}</th>
                <th className="pb-2 pr-3">{t('emailAddress')}</th>
                <th className="pb-2 pr-3">{t('adminColTeamSize')}</th>
                <th className="pb-2">{t('adminColActiveInTeam')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.supervisorTeams.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 dark:text-slate-500">
                    {t('adminNoSupervisorsYet')}
                  </td>
                </tr>
              ) : (
                data.supervisorTeams.map((row) => (
                  <tr key={row.id} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500 dark:text-slate-400">{row.email}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.teamSize}</td>
                    <td className="py-2.5 tabular-nums">{row.activeEmployees}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSectionTasksBySupervisor')}</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminSectionTasksBySupervisorDesc')}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 pr-3">{t('supervisors')}</th>
                <th className="pb-2 pr-3">{t('adminColTasksTotal')}</th>
                <th className="pb-2 pr-3">{t('taskStatusPending')}</th>
                <th className="pb-2 pr-3">{t('taskStatusInProgress')}</th>
                <th className="pb-2">{t('taskStatusCompleted')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.tasksBySupervisor.every((r) => r.total === 0) ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500">
                    {t('adminNoTasksYet')}
                  </td>
                </tr>
              ) : (
                data.tasksBySupervisor.map((row) => (
                  <tr key={row.supervisorId} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.supervisorName}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.total}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.pending}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.inProgress}</td>
                    <td className="py-2.5 tabular-nums">{row.completed}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
