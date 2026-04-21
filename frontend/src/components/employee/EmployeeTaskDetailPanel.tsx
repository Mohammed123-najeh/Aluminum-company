import React, { useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiTask, TaskStatus } from '../../services/api';
import { taskDueBucket } from '../../utils/taskDates';

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
};

type Props = {
  task: ApiTask;
  onClose: () => void;
  onUpdateStatus: (status: TaskStatus) => Promise<void>;
  onCreateOrder: () => void;
  createOrderDisabled: boolean;
  updatingStatus: boolean;
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  /** Sales role: fulfill from stock + receipt instead of plain draft order. */
  isSalesEmployee?: boolean;
  onSalesFulfill?: () => void;
};

export const EmployeeTaskDetailPanel: React.FC<Props> = ({
  task,
  onClose,
  onUpdateStatus,
  onCreateOrder,
  createOrderDisabled,
  updatingStatus,
  onUploadAttachment,
  onDeleteAttachment,
  isSalesEmployee,
  onSalesFulfill,
}) => {
  const { t } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bucket = taskDueBucket(task.dueDate, task.status);
  const attachments = task.attachments ?? [];

  const canStartOrder =
    task.status !== 'cancelled' &&
    task.status !== 'completed' &&
    (!task.orderId || task.order?.status === 'draft');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try {
      await onUploadAttachment(f);
    } finally {
      setUploading(false);
    }
  };

  const sectionShell =
    'rounded-2xl border border-slate-200/90 bg-slate-50/90 p-4 shadow-sm dark:border-slate-600/80 dark:bg-slate-800/50';
  const sectionTitle =
    'mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

  const metaRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex gap-3 text-sm">
      <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-medium text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="task-detail-title"
      >
        <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {t('tasks')}
              </p>
              <h2 id="task-detail-title" className="mt-1 text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {task.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    task.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : task.status === 'cancelled'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        : task.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {t(STATUS_LABELS[task.status] as Parameters<typeof t>[0])}
                </span>
                {bucket === 'overdue' && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                    {t('taskDueOverdue')}
                  </span>
                )}
                {bucket === 'today' && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    {t('taskDueTodayBadge')}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={t('close')}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4 pb-8">
            <section className={sectionShell}>
              <h3 className={sectionTitle}>
                <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                {t('taskDetailSectionDetails')}
              </h3>
              <div className="space-y-4">
                {task.dueDate &&
                  metaRow(
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>,
                    t('dueDate'),
                    task.dueDate,
                  )}
                {task.orderReference &&
                  metaRow(
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>,
                    t('orderReference'),
                    task.orderReference,
                  )}
                {metaRow(
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>,
                  t('assigneesLabel'),
                  task.assignees.map((a) => a.name).join(', '),
                )}
              </div>
            </section>

            {task.description && (
              <section className={sectionShell}>
                <h3 className={sectionTitle}>
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {t('description')}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{task.description}</p>
              </section>
            )}

            {task.order && (
              <section className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 to-white p-4 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/40 dark:to-slate-900/80">
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 001.921-.022 1.99 1.99 0 011.742 1.916v.027a2.25 2.25 0 01-.26 1.091l-.962 1.896A48.002 48.002 0 0018 13.5a48.002 48.002 0 00-7.5-4.5v-7.5A2.25 2.25 0 008.25 3h-5.5z" />
                  </svg>
                  {t('linkedOrderSection')}
                </h3>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('orderNumberLabel').replace('{id}', task.order.id)} · {task.order.status}
                </p>
                {task.order.customerReference && (
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {t('customerReference')}: {task.order.customerReference}
                  </p>
                )}
                <ul className="mt-3 list-inside list-disc space-y-1.5 border-t border-indigo-200/60 pt-3 text-sm text-slate-700 marker:text-indigo-400 dark:border-indigo-800/50 dark:text-slate-300">
                  {task.order.items.map((item, idx) => (
                    <li key={idx}>
                      {item.profileName} · {item.colorName} · {item.quantityM} m
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={sectionShell}>
              <h3 className={sectionTitle}>
                <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.381l-7.27 7.27a1.125 1.125 0 000 1.591l2.652 2.652a1.125 1.125 0 001.591 0l7.27-7.27a1.125 1.125 0 000-1.591l-2.652-2.652a1.125 1.125 0 00-1.591 0z" />
                </svg>
                {t('taskAttachmentsSection')}
              </h3>
              <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-500">{t('taskAttachmentsHint')}</p>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {uploading ? t('loading') : t('taskAttachmentUpload')}
              </button>
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900/60"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {a.name}
                      </a>
                      <button
                        type="button"
                        disabled={deletingId === a.id}
                        onClick={async () => {
                          setDeletingId(a.id);
                          try {
                            await onDeleteAttachment(a.id);
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                        className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        {deletingId === a.id ? '…' : t('delete')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-600/80 dark:bg-slate-800/80">
              <h3 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <svg className="h-3.5 w-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                {t('actionsCol')}
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">{t('changeTaskStatus')}</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.filter((s) => s !== task.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => onUpdateStatus(s)}
                        className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50/80 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                      >
                        {updatingStatus ? '…' : t(STATUS_LABELS[s] as Parameters<typeof t>[0])}
                      </button>
                    ))}
                  </div>
                </div>

                {canStartOrder && (
                  <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                    {task.orderId && task.order?.status !== 'draft' ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('taskAlreadyHasOrder')}</p>
                    ) : isSalesEmployee && onSalesFulfill ? (
                      <button
                        type="button"
                        disabled={createOrderDisabled}
                        onClick={onSalesFulfill}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        {t('salesFulfillFromStock')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={createOrderDisabled}
                        onClick={onCreateOrder}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-900/20 transition hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                        </svg>
                        {t('createOrderFromTask')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
};
