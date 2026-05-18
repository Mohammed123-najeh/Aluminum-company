import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiTask, TaskStatus } from '../../services/api';
import { TaskModal } from './TaskModal';
import { CustomOrderModal } from './CustomOrderModal';

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
  refetchTasks,
}) => {
  const { t } = useApp();
  const [showModal, setShowModal] = useState(false);
  /** When true, the TaskModal opens directly in the accessories flow (Step-2 catalog scoped to ACCESSORIES). */
  const [showAccessoryFlow, setShowAccessoryFlow] = useState(false);
  const [showCustomOrder, setShowCustomOrder] = useState(false);
  const [editTask, setEditTask] = useState<ApiTask | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterAssignee && !task.assignees.some((a) => a.id === filterAssignee)) return false;
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{t('allStatus')}</option>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABELS[s] as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">All assignees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCustomOrder(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:from-violet-500 hover:to-fuchsia-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 0 0-3.09 3.091ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            {t('customOrderButton')}
          </button>
          <button
            onClick={() => { setEditTask(null); setShowAccessoryFlow(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:from-amber-400 hover:to-orange-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            {t('addAccessoryTaskButton')}
          </button>
          <button
            onClick={() => { setEditTask(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('addTask')}
          </button>
        </div>
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
              {task.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{task.description}</p>
              )}
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
    </div>
  );
};

// Import for STATUS_LABELS t() - useApp is inside component
