import React, { useEffect, useMemo, useState } from 'react';
import { LOW_STOCK_THRESHOLD_M } from '../../constants/inventory';
import { useApp } from '../../contexts/AppContext';
import { useStorehouse } from '../../hooks/useStorehouse';
import type { ApiMessageThreadSummary, ApiOrder, ApiTask, TaskStatus } from '../../services/api';
import { messagesApi } from '../../services/api';

type SectionNav = 'tasks' | 'messages' | 'orders' | 'inventory';

function isOpenTaskStatus(s: TaskStatus): boolean {
  return s !== 'completed' && s !== 'cancelled';
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function taskSchedule(dueDate: string | null, status: TaskStatus): 'overdue' | 'today' | null {
  if (!dueDate || !isOpenTaskStatus(status)) return null;
  const due = dayStart(new Date(dueDate).getTime());
  const today = dayStart(Date.now());
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return null;
}

type Props = {
  tasks: ApiTask[];
  orders: ApiOrder[];
  ordersLoading: boolean;
  onGoSection: (s: SectionNav) => void;
};

export const SupervisorDashboard: React.FC<Props> = ({ tasks, orders, ordersLoading, onGoSection }) => {
  const { t, token } = useApp();
  const { inventory, loading: invLoading } = useStorehouse();
  const [threadSummaries, setThreadSummaries] = useState<ApiMessageThreadSummary[]>([]);
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
          setThreadSummaries(data as ApiMessageThreadSummary[]);
        }
      } catch {
        if (!cancelled) setThreadSummaries([]);
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const overdueTasks = useMemo(
    () => tasks.filter((x) => taskSchedule(x.dueDate, x.status) === 'overdue'),
    [tasks],
  );
  const dueTodayTasks = useMemo(
    () => tasks.filter((x) => taskSchedule(x.dueDate, x.status) === 'today'),
    [tasks],
  );

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.quantityM <= LOW_STOCK_THRESHOLD_M).length,
    [inventory],
  );

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'),
    [orders],
  );

  const loading = ordersLoading || invLoading;

  const Card: React.FC<{
    title: string;
    hint?: string;
    value: string | number;
    actionLabel: string;
    onAction: () => void;
    tone?: 'default' | 'amber' | 'rose';
  }> = ({ title, hint, value, actionLabel, onAction, tone = 'default' }) => {
    const toneCls =
      tone === 'amber'
        ? 'border-amber-200 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/30'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50/90 dark:border-rose-900/50 dark:bg-rose-950/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';
    return (
      <div className={`rounded-xl border p-4 shadow-sm ${toneCls}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{hint}</p>}
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {actionLabel}
        </button>
      </div>
    );
  };

  const TaskList: React.FC<{ items: ApiTask[]; empty: string }> = ({ items, empty }) => {
    if (items.length === 0) {
      return <p className="text-sm text-slate-500 dark:text-slate-400">{empty}</p>;
    }
    return (
      <ul className="space-y-2">
        {items.slice(0, 5).map((task) => (
          <li
            key={task.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40"
          >
            <span className="min-w-0 font-medium text-slate-900 dark:text-slate-100">{task.title}</span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {task.assignees.map((a) => a.name).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('supervisorDashboardIntro')}</p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
          {t('loading')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title={t('widgetOverdueTasks')}
          value={overdueTasks.length}
          tone="rose"
          actionLabel={t('dashboardViewAll')}
          onAction={() => onGoSection('tasks')}
        />
        <Card
          title={t('widgetDueToday')}
          value={dueTodayTasks.length}
          actionLabel={t('dashboardViewAll')}
          onAction={() => onGoSection('tasks')}
        />
        <Card
          title={t('widgetLowStock')}
          hint={t('widgetLowStockHint').replace('{threshold}', String(LOW_STOCK_THRESHOLD_M))}
          value={lowStockCount}
          tone={lowStockCount > 0 ? 'amber' : 'default'}
          actionLabel={t('dashboardViewAll')}
          onAction={() => onGoSection('inventory')}
        />
        <Card
          title={t('widgetOrders')}
          hint={t('widgetOrdersHint')}
          value={activeOrders.length}
          actionLabel={t('dashboardViewAll')}
          onAction={() => onGoSection('orders')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('widgetOverdueTasks')}</h3>
            <button
              type="button"
              onClick={() => onGoSection('tasks')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              {t('dashboardViewAll')}
            </button>
          </div>
          <TaskList items={overdueTasks} empty={t('noOverdueTasks')} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('widgetDueToday')}</h3>
            <button
              type="button"
              onClick={() => onGoSection('tasks')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              {t('dashboardViewAll')}
            </button>
          </div>
          <TaskList items={dueTodayTasks} empty={t('noDueTodayTasks')} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('widgetConversations')}</h3>
            <button
              type="button"
              onClick={() => onGoSection('messages')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              {t('dashboardViewAll')}
            </button>
          </div>
          {msgLoading ? (
            <p className="text-sm text-slate-500">{t('loading')}</p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('conversationsCount').replace('{count}', String(threadSummaries.length))}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboardRecentOrders')}</h3>
            <button
              type="button"
              onClick={() => onGoSection('orders')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              {t('dashboardViewAll')}
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('noOrdersYet')}</p>
          ) : (
            <ul className="space-y-2">
              {orders.slice(0, 5).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    #{o.id} · {o.customerReference || '—'}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
