import React, { useEffect, useMemo, useState } from 'react';
import { LOW_STOCK_THRESHOLD_UNITS } from '../../constants/inventory';
import { useApp } from '../../contexts/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { useStorehouse } from '../../hooks/useStorehouse';
import type { ApiMessageInboxSummary, ApiOrder, ApiTask, TaskStatus, ApiPayrollSummary } from '../../services/api';
import { messagesApi, attendanceApi } from '../../services/api';
import { taskDueBucket } from '../../utils/taskDates';
import { formatIls } from '../../utils/currency';
import { AnalyticsDateFilter, type AnalyticsRange } from '../admin/AnalyticsDateFilter';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
};

type Props = {
  tasks: ApiTask[];
  loading: boolean;
  error: string | null;
  onGoTasks: () => void;
  onGoInventory: () => void;
  /** Hide low-stock / inventory shortcut (e.g. HR role). */
  hideInventory?: boolean;
  /** Opens My Tasks and focuses this task in the detail panel. */
  onOpenTask?: (taskId: string) => void;
};

/**
 * Pastel-square stat tile used by the overview cards. Optional onClick turns the
 * whole card into a button.
 */
function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
  onClick,
  iconBg,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
  onClick?: () => void;
  iconBg: string;
  icon: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`mt-3 flex items-baseline gap-1.5 text-3xl font-bold tabular-nums ${accent ?? 'text-slate-900 dark:text-slate-100'}`}>
        {value}
        {unit && <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </>
  );
  const base = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-800';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} text-start hover:border-indigo-200 dark:hover:border-indigo-900`}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

const Icons = {
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-rose-600 dark:text-rose-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-amber-600 dark:text-amber-300">
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-indigo-600 dark:text-indigo-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l14 8-14 8V4z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-emerald-600 dark:text-emerald-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  hours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-sky-600 dark:text-sky-300">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-violet-600 dark:text-violet-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-orange-600 dark:text-orange-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    </svg>
  ),
};

/**
 * Formats a minute count as "Hh MMm". Returns "0h 00m" when zero so the layout
 * doesn't jump between filters.
 */
function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const EmployeeAnalytics: React.FC<Props> = ({
  tasks,
  loading,
  error,
  onGoTasks,
  onGoInventory,
  hideInventory = false,
  onOpenTask,
}) => {
  const { t, token } = useApp();
  const { orders, loading: ordersLoading } = useOrders();
  const { inventory } = useStorehouse();
  const [inboxSummaries, setInboxSummaries] = useState<ApiMessageInboxSummary[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [range, setRange] = useState<AnalyticsRange>(null);
  const [attendance, setAttendance] = useState<ApiPayrollSummary | null>(null);
  const [attLoading, setAttLoading] = useState(false);

  // Messages inbox is loaded once; filter is applied client-side.
  useEffect(() => {
    if (!token) {
      setMsgLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await messagesApi.list(token);
        if (!cancelled && Array.isArray(data)) {
          setInboxSummaries(data as unknown as ApiMessageInboxSummary[]);
        }
      } catch {
        if (!cancelled) setInboxSummaries([]);
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Attendance summary is fetched per-range so the Hours/Earnings tiles reflect
  // the chosen window. Without a filter, the endpoint defaults to "this month".
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setAttLoading(true);
    attendanceApi
      .summary(token, range ?? undefined)
      .then((d) => { if (!cancelled) setAttendance(d); })
      .catch(() => { if (!cancelled) setAttendance(null); })
      .finally(() => { if (!cancelled) setAttLoading(false); });
    return () => { cancelled = true; };
  }, [token, range?.from, range?.to]);

  // Range-aware tests for createdAt-style fields.
  const inRange = useMemo(() => {
    if (!range) return () => true;
    const fromMs = new Date(`${range.from}T00:00:00`).getTime();
    const toMs = new Date(`${range.to}T23:59:59`).getTime();
    return (iso: string | null | undefined) => {
      if (!iso) return false;
      const ts = new Date(iso).getTime();
      return ts >= fromMs && ts <= toMs;
    };
  }, [range]);

  // Tasks scoped to the active range (by created date). Used by status mix
  // and the "completed in period" counter. Urgency banners (overdue/due today)
  // stay unfiltered — they're current-state signals.
  const tasksInRange = useMemo(
    () => (range ? tasks.filter((x) => inRange(x.createdAt)) : tasks),
    [tasks, range, inRange],
  );

  const byStatus = useMemo(() => {
    const m: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    tasksInRange.forEach((x) => {
      m[x.status] += 1;
    });
    return m;
  }, [tasksInRange]);

  // Urgency signals (always current state, never date-filtered).
  const overdueTasks = useMemo(
    () => tasks.filter((x) => taskDueBucket(x.dueDate, x.status) === 'overdue'),
    [tasks],
  );
  const dueTodayTasks = useMemo(
    () => tasks.filter((x) => taskDueBucket(x.dueDate, x.status) === 'today'),
    [tasks],
  );

  const activeTasks = useMemo(
    () => tasks.filter((x) => x.status === 'pending' || x.status === 'in_progress').length,
    [tasks],
  );

  const completedInPeriod = byStatus.completed;

  const lowStockCount = useMemo(
    () =>
      hideInventory ? 0 : inventory.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD_UNITS).length,
    [hideInventory, inventory],
  );

  const ordersInRange = useMemo(
    () => (range ? orders.filter((o) => inRange(o.createdAt)) : orders),
    [orders, range, inRange],
  );
  const recentOrders = useMemo(() => ordersInRange.slice(0, 5), [ordersInRange]);

  const messagesInRange = useMemo(
    () => (range ? inboxSummaries.filter((m) => inRange(m.lastAt)) : inboxSummaries),
    [inboxSummaries, range, inRange],
  );

  // My row from the attendance summary (the endpoint returns either a single
  // row for an employee, or many for supervisor/admin — we always pick the first).
  const myAtt = attendance?.rows?.[0] ?? null;
  const hoursLabel = myAtt ? fmtMinutes(myAtt.totalMinutes) : '0h 00m';
  const earnings = myAtt?.computedEarnings ?? 0;

  if (loading || error) {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  const total = tasksInRange.length || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('employeeOverviewIntro')}</p>

      <AnalyticsDateFilter value={range} onChange={setRange} />

      {overdueTasks.length > 0 && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/30"
          role="status"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
              {t('taskReminderOverdue').replace('{n}', String(overdueTasks.length))}
            </p>
            <button
              type="button"
              onClick={() => onGoTasks()}
              className="text-sm font-semibold text-rose-800 underline dark:text-rose-200"
            >
              {t('dashboardViewAll')}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {overdueTasks.slice(0, 4).map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask?.(x.id)}
                  className="text-left text-sm text-rose-800 hover:underline dark:text-rose-200"
                >
                  → {x.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dueTodayTasks.length > 0 && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
          role="status"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              {t('taskReminderDueToday').replace('{n}', String(dueTodayTasks.length))}
            </p>
            <button
              type="button"
              onClick={() => onGoTasks()}
              className="text-sm font-semibold text-amber-900 underline dark:text-amber-200"
            >
              {t('dashboardViewAll')}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {dueTodayTasks.slice(0, 4).map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask?.(x.id)}
                  className="text-left text-sm text-amber-950 hover:underline dark:text-amber-100"
                >
                  → {x.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t('widgetOverdueTasks')}
          value={String(overdueTasks.length)}
          accent="text-rose-600 dark:text-rose-400"
          onClick={onGoTasks}
          iconBg="bg-rose-50 dark:bg-rose-950/40"
          icon={Icons.alert}
        />
        <StatCard
          label={t('widgetDueToday')}
          value={String(dueTodayTasks.length)}
          accent="text-amber-600 dark:text-amber-400"
          onClick={onGoTasks}
          iconBg="bg-amber-50 dark:bg-amber-950/40"
          icon={Icons.clock}
        />
        <StatCard
          label={t('employee.kpi.activeTasks')}
          value={String(activeTasks)}
          accent="text-indigo-600 dark:text-indigo-400"
          onClick={onGoTasks}
          iconBg="bg-indigo-50 dark:bg-indigo-950/40"
          icon={Icons.play}
        />
        <StatCard
          label={t('employee.kpi.completedInPeriod')}
          value={String(completedInPeriod)}
          accent="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          icon={Icons.check}
        />
        <StatCard
          label={t('employee.kpi.hoursInPeriod')}
          value={attLoading ? '…' : hoursLabel}
          accent="text-sky-600 dark:text-sky-400"
          iconBg="bg-sky-50 dark:bg-sky-950/40"
          icon={Icons.hours}
        />
        <StatCard
          label={t('employee.kpi.earningsInPeriod')}
          value={attLoading ? '…' : formatIls(earnings).replace(/[^\d.,-]/g, '').trim()}
          unit={t('currencyIls')}
          accent="text-violet-600 dark:text-violet-400"
          iconBg="bg-violet-50 dark:bg-violet-950/40"
          icon={Icons.money}
        />
      </div>

      {!hideInventory && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label={t('widgetLowStock')}
            value={String(lowStockCount)}
            accent="text-orange-600 dark:text-orange-400"
            hint={t('widgetLowStockHint').replace('{threshold}', String(LOW_STOCK_THRESHOLD_UNITS))}
            onClick={onGoInventory}
            iconBg="bg-orange-50 dark:bg-orange-950/40"
            icon={Icons.box}
          />
          <StatCard
            label={t('employee.kpi.ordersInPeriod')}
            value={ordersLoading ? '…' : String(ordersInRange.length)}
            accent="text-slate-900 dark:text-slate-100"
            hint={t('widgetOrdersHint')}
            iconBg="bg-slate-100 dark:bg-slate-700/60"
            icon={Icons.play}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('employeeTaskStatusMix')}</h3>
        <div className="mt-4 space-y-3">
          {(['pending', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
            <div key={s}>
              <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{t(STATUS_LABELS[s] as Parameters<typeof t>[0])}</span>
                <span>
                  {byStatus[s]} ({pct(byStatus[s])}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    s === 'pending'
                      ? 'bg-slate-400'
                      : s === 'in_progress'
                        ? 'bg-amber-400'
                        : s === 'completed'
                          ? 'bg-emerald-500'
                          : 'bg-red-400'
                  }`}
                  style={{ width: `${pct(byStatus[s])}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('employeeWorkSummary')}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>
              {msgLoading
                ? t('loading')
                : t('inboxThreadsCount').replace('{n}', String(messagesInRange.length))}
            </li>
            {myAtt && myAtt.sessionsCount > 0 && (
              <li>
                {t('employee.kpi.sessions').replace('{n}', String(myAtt.sessionsCount))}
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={onGoTasks}
            className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {t('dashboardViewAll')} → {t('myTasks')}
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboardRecentOrders')}</h3>
          {ordersInRange.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('noOrdersYet')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentOrders.map((o: ApiOrder) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    #{o.id} {o.taskTitle ? `· ${o.taskTitle}` : ''}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{o.status}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">{t('employeeOrdersFromTasksNote')}</p>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-500">{t('employeeAnalyticsFootnote')}</p>
    </div>
  );
};
