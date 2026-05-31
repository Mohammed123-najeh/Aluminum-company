import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useOrders } from '../../hooks/useOrders';
import { useStorehouse } from '../../hooks/useStorehouse';
import type { ApiTask, ApiUser, TaskStatus } from '../../services/api';
import { taskDueBucket } from '../../utils/taskDates';
import { stripCustomOrderFence } from '../../utils/taskDescription';
import { onFocusFlash, flashElement } from '../../utils/focusFlash';
import { CreateOrderModal } from './CreateOrderModal';
import { EmployeeTaskDetailPanel } from './EmployeeTaskDetailPanel';
import { SalesTaskFulfillmentModal } from './SalesTaskFulfillmentModal';

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
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
  onUpdateStatus: (id: string, payload: { status: TaskStatus }) => Promise<ApiTask | undefined>;
  onRefetchTasks?: () => void | Promise<void>;
  /** When set (e.g. from Overview), opens the task detail panel once. */
  focusTaskId?: string | null;
  onFocusTaskConsumed?: () => void;
  uploadTaskAttachment?: (taskId: string, file: File) => Promise<ApiTask | undefined>;
  deleteTaskAttachment?: (taskId: string, attachmentId: string) => Promise<ApiTask | undefined>;
  currentUser: ApiUser | null;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export const EmployeeTasks: React.FC<Props> = ({
  tasks,
  loading,
  error,
  onUpdateStatus,
  onRefetchTasks,
  focusTaskId,
  onFocusTaskConsumed,
  uploadTaskAttachment,
  deleteTaskAttachment,
  currentUser,
}) => {
  const { t } = useApp();
  const { createOrder, refetch: refetchOrders } = useOrders();
  const { profiles, colors, inventory, loading: storeLoading } = useStorehouse();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderTaskId, setOrderTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [salesFulfillTaskId, setSalesFulfillTaskId] = useState<string | null>(null);

  const isSalesEmployee = currentUser?.role === 'employee' && currentUser?.employeeType === 'sales';

  useEffect(() => {
    if (!focusTaskId) return;
    setDetailTaskId(focusTaskId);
    onFocusTaskConsumed?.();
  }, [focusTaskId, onFocusTaskConsumed]);

  // Notification deep-link: scroll the task row into view and apply a 2s flash.
  useEffect(() => {
    return onFocusFlash('task', (taskId) => {
      // Defer so the row is mounted (especially right after navigation).
      window.requestAnimationFrame(() => {
        const node = document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(taskId)}"]`);
        flashElement(node);
      });
    });
  }, []);

  const linkedTaskTitle = useMemo(
    () => (orderTaskId ? tasks.find((x) => x.id === orderTaskId)?.title ?? null : null),
    [tasks, orderTaskId],
  );

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((x) => x.id === detailTaskId) ?? null : null),
    [tasks, detailTaskId],
  );

  const openOrderModal = (taskId: string) => {
    setOrderTaskId(taskId);
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setOrderTaskId(null);
  };

  const filteredTasks = useMemo(() => {
    let list = filterStatus ? tasks.filter((task) => task.status === filterStatus) : tasks;
    const q = norm(searchQuery);
    if (q) {
      list = list.filter((task) => {
        const title = task.title ?? '';
        const desc = task.description ?? '';
        const ref = task.orderReference ?? '';
        return norm(title).includes(q) || norm(desc).includes(q) || norm(ref).includes(q);
      });
    }
    return list;
  }, [tasks, filterStatus, searchQuery]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setUpdatingId(taskId);
    try {
      await onUpdateStatus(taskId, { status });
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = tasks.filter((x) => x.status === 'pending').length;
  const inProgressCount = tasks.filter((x) => x.status === 'in_progress').length;
  const completedCount = tasks.filter((x) => x.status === 'completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
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

  const salesFulfillTask = salesFulfillTaskId ? tasks.find((x) => x.id === salesFulfillTaskId) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{tasks.length}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('tasks')} total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('taskStatusPending')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgressCount}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('taskStatusInProgress')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('taskStatusCompleted')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('taskSearchLabel')}</label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchTasksPlaceholder')}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('filterByStatus')}:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{t('allStatus')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABELS[s] as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            {tasks.length === 0 ? t('noTasksAssigned') : t('noTasksMatchFilter')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const bucket = taskDueBucket(task.dueDate, task.status);
            return (
              <button
                key={task.id}
                type="button"
                data-task-id={task.id}
                onClick={() => setDetailTaskId(task.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900 dark:hover:bg-slate-800/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
                    {(() => {
                      const desc = stripCustomOrderFence(task.description);
                      return desc ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                      ) : null;
                    })()}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : task.status === 'cancelled'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : task.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {t(STATUS_LABELS[task.status] as Parameters<typeof t>[0])}
                      </span>
                      {bucket === 'overdue' && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                          {t('taskDueOverdue')}
                        </span>
                      )}
                      {bucket === 'today' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                          {t('taskDueTodayBadge')}
                        </span>
                      )}
                      {task.orderId && (
                        <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                          {t('taskCardHasOrder')}
                        </span>
                      )}
                    </div>
                    {task.dueDate && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                        {t('dueDate')}: {task.dueDate}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400">{t('taskCardOpenDetail')}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detailTask && (
        <EmployeeTaskDetailPanel
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onUpdateStatus={async (status) => {
            await handleStatusChange(detailTask.id, status);
          }}
          createOrderDisabled={storeLoading}
          updatingStatus={updatingId === detailTask.id}
          onCreateOrder={() => {
            setDetailTaskId(null);
            openOrderModal(detailTask.id);
          }}
          isSalesEmployee={isSalesEmployee}
          onSalesFulfill={
            isSalesEmployee
              ? () => {
                  const id = detailTask.id;
                  setDetailTaskId(null);
                  setSalesFulfillTaskId(id);
                }
              : undefined
          }
          onUploadAttachment={async (file) => {
            if (!uploadTaskAttachment) return;
            await uploadTaskAttachment(detailTask.id, file);
            await onRefetchTasks?.();
          }}
          onDeleteAttachment={async (attachmentId) => {
            if (!deleteTaskAttachment) return;
            await deleteTaskAttachment(detailTask.id, attachmentId);
            await onRefetchTasks?.();
          }}
        />
      )}

      {salesFulfillTaskId && salesFulfillTask && (
        <SalesTaskFulfillmentModal
          taskId={salesFulfillTaskId}
          taskTitle={salesFulfillTask.title}
          onClose={() => setSalesFulfillTaskId(null)}
          onCompleted={async () => {
            await onRefetchTasks?.();
            await refetchOrders();
          }}
        />
      )}

      {showOrderModal && !storeLoading && orderTaskId && (
        <CreateOrderModal
          profiles={profiles}
          colors={colors}
          inventory={inventory}
          taskIdToLink={orderTaskId}
          linkedTaskTitle={linkedTaskTitle}
          onSubmit={async (payload) => {
            await createOrder(payload);
            closeOrderModal();
            await onRefetchTasks?.();
          }}
          onClose={closeOrderModal}
        />
      )}
    </div>
  );
};
