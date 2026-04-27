import React, { useEffect, useMemo, useState } from 'react';
import { LOW_STOCK_THRESHOLD_UNITS } from '../../constants/inventory';
import { useApp } from '../../contexts/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { useStorehouse } from '../../hooks/useStorehouse';
import type { ApiMessageInboxSummary, ApiOrder, ApiTask, TaskStatus } from '../../services/api';
import { messagesApi } from '../../services/api';
import { taskDueBucket } from '../../utils/taskDates';

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

  const byStatus = useMemo(() => {
    const m: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    tasks.forEach((x) => {
      m[x.status] += 1;
    });
    return m;
  }, [tasks]);

  const overdueTasks = useMemo(
    () => tasks.filter((x) => taskDueBucket(x.dueDate, x.status) === 'overdue'),
    [tasks],
  );
  const dueTodayTasks = useMemo(
    () => tasks.filter((x) => taskDueBucket(x.dueDate, x.status) === 'today'),
    [tasks],
  );
  const tasksWithOrder = useMemo(() => tasks.filter((x) => Boolean(x.orderId)).length, [tasks]);

  const lowStockCount = useMemo(
    () =>
      hideInventory ? 0 : inventory.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD_UNITS).length,
    [hideInventory, inventory],
  );

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'),
    [orders],
  );

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

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

  const total = tasks.length || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('employeeOverviewIntro')}</p>

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

      <div
        className={`grid gap-4 sm:grid-cols-2 ${hideInventory ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}
      >
        <button
          type="button"
          onClick={onGoTasks}
          className="rounded-xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('widgetOverdueTasks')}
          </p>
          <p className="mt-1 text-3xl font-bold text-rose-600 dark:text-rose-400">{overdueTasks.length}</p>
        </button>
        <button
          type="button"
          onClick={onGoTasks}
          className="rounded-xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('widgetDueToday')}
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400">{dueTodayTasks.length}</p>
        </button>
        {!hideInventory && (
          <button
            type="button"
            onClick={onGoInventory}
            className="rounded-xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('widgetLowStock')}
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{lowStockCount}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {t('widgetLowStockHint').replace('{threshold}', String(LOW_STOCK_THRESHOLD_UNITS))}
            </p>
          </button>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('employeeOrdersYouCreated')}
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {ordersLoading ? '…' : activeOrders.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{t('widgetOrdersHint')}</p>
        </div>
      </div>

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
              {t('tasksWithLinkedOrder').replace('{n}', String(tasksWithOrder))}
            </li>
            <li>
              {msgLoading ? t('loading') : t('inboxThreadsCount').replace('{n}', String(inboxSummaries.length))}
            </li>
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
          {orders.length === 0 ? (
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
