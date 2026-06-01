import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiTask, TaskStatus } from '../../services/api';
import { TaskModal } from './TaskModal';
import { CustomOrderModal } from './CustomOrderModal';
import { TaskDescription } from './TaskDescription';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
};

type Props = {
  employees: User[];
  tasks: ApiTask[];
  loading: boolean;
  error: string | null;
  onCreateTask: (payload: {
    assignee_ids: string[];
    title: string;
    description?: string | null;
    due_date?: string | null;
    order_reference?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    client_id?: string | null;
    order_id?: string | null;
  }) => Promise<ApiTask | undefined>;
  onUpdateTask: (
    id: string,
    payload: {
      status?: TaskStatus;
      title?: string;
      description?: string | null;
      due_date?: string | null;
      order_reference?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      client_id?: string | null;
      order_id?: string | null;
      assignee_ids?: string[];
    },
  ) => Promise<ApiTask | undefined>;
  onDeleteTask: (id: string) => Promise<void>;
  onCancelTask?: (id: string, reason: string | null) => Promise<{ task: ApiTask; refundedAmount: number } | undefined>;
  refetchTasks?: () => void | Promise<void>;
};

export const SupervisorTasks: React.FC<Props> = ({
  employees,
  tasks,
  loading,
  error,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onCancelTask,
  refetchTasks,
}) => {
  const { t } = useApp();
  const [showModal, setShowModal] = useState(false);
  /** When true, the TaskModal opens directly in the accessories flow (Step-2 catalog scoped to ACCESSORIES). */
  const [showAccessoryFlow, setShowAccessoryFlow] = useState(false);
  const [showCustomOrder, setShowCustomOrder] = useState(false);
  /** Drives the "choose task type" popup that the single orange "Add task" button opens. */
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [editTask, setEditTask] = useState<ApiTask | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Cancellation flow: clicking Cancel opens a confirmation panel with the
  // refund summary + optional reason. Kept inline so we don't need another
  // modal file just for one confirm step.
  const [cancelTarget, setCancelTarget] = useState<ApiTask | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filteredTasks = tasks.filter(() => {
    return true;
  });

  const handleCreate = async (payload: {
    assignee_ids: string[];
    title: string;
    description?: string | null;
    due_date?: string | null;
    order_reference?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    client_id?: string | null;
    order_id?: string | null;
  }) => {
    return await onCreateTask(payload);
  };

  const handleUpdate = async (
    id: string,
    payload: {
      status?: TaskStatus;
      title?: string;
      description?: string | null;
      due_date?: string | null;
      order_reference?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      client_id?: string | null;
      order_id?: string | null;
      assignee_ids?: string[];
    },
  ) => {
    return await onUpdateTask(id, payload);
  };

  const closeModal = () => {
    void refetchTasks?.();
    setShowModal(false);
    setShowAccessoryFlow(false);
    setEditTask(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('deleteTaskConfirm'))) return;
    setDeletingId(id);
    try {
      await onDeleteTask(id);
    } finally {
      setDeletingId(null);
    }
  };

  const openCancelDialog = (task: ApiTask) => {
    setCancelTarget(task);
    setCancelReason('');
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !onCancelTask) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await onCancelTask(cancelTarget.id, cancelReason.trim() || null);
      setCancelTarget(null);
      setCancelReason('');
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : t('taskCancelError'));
    } finally {
      setCancelling(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddChooser(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:from-amber-400 hover:to-orange-400"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('addTaskChooserButton')}
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">{tasks.length === 0 ? t('noTasksYet') : 'No tasks match filters.'}</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{t('createFirstTask')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
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
              </div>
              <TaskDescription description={task.description} clamp className="mt-1.5" />
              {task.customerName && (
                <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {t('taskCustomerNameLabel')}: {task.customerName}
                </p>
              )}
              {task.clientName && (
                <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {t('receiptClientName')}: {task.clientName}
                  {task.clientPhone ? ` · ${task.clientPhone}` : ''}
                </p>
              )}
              {task.customerPhone && !task.clientId && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {t('receiptCustomerPhone')}: {task.customerPhone}
                </p>
              )}
              {task.orderReference && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Ref: {task.orderReference}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {task.assignees.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {a.name}
                  </span>
                ))}
              </div>
              {task.dueDate && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('dueDate')}: {task.dueDate}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditTask(task)}
                  className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t('edit')}
                </button>
                {/* Cancel button only when the task is still in progress and we have a handler.
                    Completed/cancelled tasks shouldn't be re-cancelled. */}
                {onCancelTask && (task.status === 'pending' || task.status === 'in_progress') && (
                  <button
                    type="button"
                    onClick={() => openCancelDialog(task)}
                    className="rounded-lg border border-amber-200 px-2 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  >
                    {t('taskCancelButton')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  disabled={deletingId === task.id}
                  className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  {deletingId === task.id ? '…' : t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showModal || showAccessoryFlow || editTask) && (
        <TaskModal
          employees={employees}
          task={editTask}
          onSave={editTask ? (p) => handleUpdate(editTask.id, p) : handleCreate}
          onClose={closeModal}
          initialCatalogScope={showAccessoryFlow ? 'accessories' : 'aluminum'}
        />
      )}

      {showCustomOrder && (
        <CustomOrderModal
          employees={employees}
          onSave={handleCreate}
          onClose={() => {
            void refetchTasks?.();
            setShowCustomOrder(false);
          }}
        />
      )}

      {showAddChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddChooser(false)} aria-hidden />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-start justify-between gap-4 bg-linear-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
              <div>
                <h2 className="text-base font-bold leading-tight">{t('addTaskChooserTitle')}</h2>
                <p className="mt-0.5 text-xs text-white/85">{t('addTaskChooserSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddChooser(false)}
                className="rounded-lg bg-white/10 p-1.5 text-white/90 transition hover:bg-white/20"
                aria-label={t('close')}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 p-4">
              <button
                type="button"
                onClick={() => { setShowAddChooser(false); setEditTask(null); setShowModal(true); }}
                className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-start transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-600 dark:bg-slate-700/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t('addTaskChooserAluminumTitle')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t('addTaskChooserAluminumDesc')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setShowAddChooser(false); setEditTask(null); setShowAccessoryFlow(true); }}
                className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-start transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-600 dark:bg-slate-700/40 dark:hover:border-orange-500 dark:hover:bg-orange-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-r from-amber-500 to-orange-500 text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t('addTaskChooserAccessoryTitle')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t('addTaskChooserAccessoryDesc')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setShowAddChooser(false); setShowCustomOrder(true); }}
                className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-start transition hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-600 dark:bg-slate-700/40 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 0 0-3.09 3.091Z" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t('addTaskChooserCustomTitle')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t('addTaskChooserCustomDesc')}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => !cancelling && setCancelTarget(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="bg-linear-to-r from-amber-500 to-rose-500 px-5 py-4 text-white">
              <h2 className="text-base font-bold leading-tight">{t('taskCancelDialogTitle')}</h2>
              <p className="mt-0.5 text-xs text-white/85">
                {t('taskCancelDialogSubtitle').replace('{title}', cancelTarget.title)}
              </p>
            </div>
            <div className="space-y-4 p-5">
              {/* Refund preview — pulled directly from the order's amountPaid. */}
              {(() => {
                const paid = cancelTarget.order?.amountPaid ?? 0;
                const total = cancelTarget.order?.totalAmount ?? null;
                if (paid > 0.009) {
                  return (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="font-semibold">{t('taskCancelRefundWarning')}</p>
                      <p className="mt-1">
                        {t('taskCancelRefundLine')
                          .replace('{paid}', paid.toFixed(2))
                          .replace('{total}', total != null ? total.toFixed(2) : '—')}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                    {t('taskCancelNoPayment')}
                  </div>
                );
              })()}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('taskCancelReasonLabel')}
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder={t('taskCancelReasonPlaceholder')}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              {cancelError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {cancelError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={cancelling}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmCancel()}
                  disabled={cancelling}
                  className="rounded-lg bg-linear-to-r from-amber-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-amber-400 hover:to-rose-400 disabled:opacity-50"
                >
                  {cancelling ? '…' : t('taskCancelConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Import for STATUS_LABELS t() - useApp is inside component
