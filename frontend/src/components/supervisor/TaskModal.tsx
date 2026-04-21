import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { AiTaskTextMode, ApiClient, ApiTask, TaskStatus } from '../../services/api';
import { aiApi, clientsApi } from '../../services/api';
import { useOrders } from '../../hooks/useOrders';
import { StockTaskFulfillmentPanel } from '../shared/StockTaskFulfillmentPanel';

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
  cancelled: 'taskStatusCancelled',
};

const COLORS = ['bg-blue-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-rose-500', 'bg-pink-500'];
const avatarColor = (id: string) => COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

type SavePayload = {
  assignee_ids: string[];
  title: string;
  description?: string | null;
  due_date?: string | null;
  order_reference?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  client_id?: string | null;
  order_id?: string | null;
  status?: TaskStatus;
};

type Props = {
  employees: User[];
  task: ApiTask | null;
  onSave: (payload: SavePayload) => Promise<ApiTask | undefined>;
  onClose: () => void;
};

export const TaskModal: React.FC<Props> = ({ employees, task, onSave, onClose }) => {
  const { t, token } = useApp();
  const { orders, refetch: refetchOrders } = useOrders();
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [orderReference, setOrderReference] = useState(task?.orderReference ?? '');
  const [customerName, setCustomerName] = useState(task?.customerName ?? '');
  const [orderId, setOrderId] = useState<string | null>(task?.orderId ?? null);
  const [clientId, setClientId] = useState<string | null>(task?.clientId ?? null);
  const [customerPhone, setCustomerPhone] = useState(task?.customerPhone ?? '');
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task ? task.assignees.map((a) => a.id) : []);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState<'title' | 'description' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** New task: 1 = task form, 2 = full-page stock & receipt. */
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [savedNewTask, setSavedNewTask] = useState<ApiTask | null>(null);
  /** Edit task: fullscreen stock overlay. */
  const [editStockOpen, setEditStockOpen] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setDueDate(task?.dueDate ?? '');
    setOrderReference(task?.orderReference ?? '');
    setCustomerName(task?.customerName ?? '');
    setOrderId(task?.orderId ?? null);
    setClientId(task?.clientId ?? null);
    setCustomerPhone(task?.customerPhone ?? '');
    setStatus(task?.status ?? 'pending');
    setAssigneeIds(task ? task.assignees.map((a) => a.id) : []);
    setCreateStep(1);
    setSavedNewTask(null);
    setEditStockOpen(false);
    setSaveError(null);
  }, [task?.id, task]);

  useEffect(() => {
    if (!token) return;
    void clientsApi
      .list(token)
      .then((rows) => setClients(rows))
      .catch(() => setClients([]));
  }, [token]);

  const clientLabel = useMemo(() => {
    if (!clientId) return null;
    const c = clients.find((x) => x.id === clientId);
    return c ? `${c.name}${c.phone ? ` · ${c.phone}` : ''}` : null;
  }, [clientId, clients]);

  const receiptCustomerInfo = useMemo(
    () => ({
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      clientLabel,
    }),
    [customerName, customerPhone, clientLabel],
  );

  const runAi = async (
    field: 'title' | 'description',
    mode: AiTaskTextMode,
    current: string,
    setValue: (v: string) => void,
  ) => {
    if (!token || !current.trim()) return;
    setAiError(null);
    setAiLoadingField(field);
    try {
      const { text } = await aiApi.taskText(token, { field, text: current.trim(), mode });
      setValue(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const low = msg.toLowerCase();
      setAiError(low.includes('not configured') ? t('aiNotConfigured') : t('aiError'));
    } finally {
      setAiLoadingField(null);
    }
  };

  const aiBtn =
    'rounded-lg border border-violet-200 bg-violet-50/90 px-2 py-1 text-[11px] font-medium text-violet-800 transition hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/70';

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id && !assigneeIds.includes(id)) {
      setAssigneeIds((prev) => [...prev, id]);
    }
  };

  const removeAssignee = (id: string) => {
    setAssigneeIds((prev) => prev.filter((x) => x !== id));
  };

  const assigneeUsers = assigneeIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean) as User[];
  const availableEmployees = employees.filter((e) => !assigneeIds.includes(e.id));

  const buildPayload = (): SavePayload => ({
    assignee_ids: assigneeIds,
    title: title.trim(),
    description: description.trim() || null,
    due_date: dueDate.trim() || null,
    order_reference: orderReference.trim() || null,
    customer_name: customerName.trim() || null,
    customer_phone: customerPhone.trim() || null,
    client_id: clientId || null,
    order_id: orderId || null,
    ...(isEdit ? { status } : {}),
  });

  const handleSaveTaskOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || assigneeIds.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await onSave(buildPayload());
      if (isEdit) {
        onClose();
        return;
      }
      if (saved) {
        setSavedNewTask(saved);
        setCreateStep(2);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('invalidCredentials'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStock = () => {
    onClose();
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500';

  const stockTaskTitle =
    ((isEdit ? task?.title : savedNewTask?.title) ?? title.trim()) || t('tasks');

  const showCreateStep2 = !isEdit && createStep === 2 && savedNewTask;
  const showEditStock = isEdit && editStockOpen && task;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={showCreateStep2 || showEditStock ? undefined : onClose}
        aria-hidden
      />
      <div
        className={`relative flex max-h-dvh flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-800 sm:max-h-[90vh] sm:rounded-2xl ${
          showCreateStep2 || showEditStock ? 'h-full w-full sm:h-[min(92dvh,900px)] sm:max-w-6xl' : 'w-full max-w-xl'
        }`}
      >
        {showCreateStep2 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  {t('taskWizardStep2Badge')}
                </p>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('taskStockFullPageTitle')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{savedNewTask.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateStep(1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t('taskBackToTaskForm')}
                </button>
                <button
                  type="button"
                  onClick={handleSkipStock}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('taskFinishWithoutReceipt')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700"
                  aria-label={t('close')}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
              <StockTaskFulfillmentPanel
                key={savedNewTask.id}
                variant="fullscreen"
                mode="supervisor"
                taskId={savedNewTask.id}
                taskTitle={stockTaskTitle}
                receiptCustomerInfo={receiptCustomerInfo}
                onFulfilled={() => void refetchOrders()}
                onReceiptDismiss={onClose}
              />
            </div>
          </div>
        ) : showEditStock ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('taskStockFullPageTitle')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{task.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditStockOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('close')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
              <StockTaskFulfillmentPanel
                key={`${task.id}-stock`}
                variant="fullscreen"
                mode="supervisor"
                taskId={task.id}
                taskTitle={stockTaskTitle}
                receiptCustomerInfo={receiptCustomerInfo}
                onFulfilled={() => void refetchOrders()}
                onReceiptDismiss={() => {
                  setEditStockOpen(false);
                  onClose();
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {isEdit ? `${t('edit')} · ${t('tasks')}` : t('addTask')}
                </h2>
                {!isEdit && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('taskWizardStep1Hint')}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveTaskOnly} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              {aiError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  {aiError}
                </div>
              )}
              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {saveError}
                </div>
              )}
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('taskTitle')}</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600/80 dark:text-violet-400/90">
                      {t('aiAssistLabel')}
                    </span>
                    <button
                      type="button"
                      disabled={!title.trim() || aiLoadingField !== null || !token}
                      className={aiBtn}
                      onClick={() => runAi('title', 'improve', title, setTitle)}
                    >
                      {aiLoadingField === 'title' ? '…' : t('aiImprove')}
                    </button>
                    <button
                      type="button"
                      disabled={!title.trim() || aiLoadingField !== null || !token}
                      className={aiBtn}
                      onClick={() => runAi('title', 'shorten', title, setTitle)}
                    >
                      {aiLoadingField === 'title' ? '…' : t('aiShorten')}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                  placeholder={t('taskTitle')}
                  required
                />
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('taskDescription')}</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600/80 dark:text-violet-400/90">
                      {t('aiAssistLabel')}
                    </span>
                    <button
                      type="button"
                      disabled={!description.trim() || aiLoadingField !== null || !token}
                      className={aiBtn}
                      onClick={() => runAi('description', 'improve', description, setDescription)}
                    >
                      {aiLoadingField === 'description' ? '…' : t('aiImprove')}
                    </button>
                    <button
                      type="button"
                      disabled={!description.trim() || aiLoadingField !== null || !token}
                      className={aiBtn}
                      onClick={() => runAi('description', 'shorten', description, setDescription)}
                    >
                      {aiLoadingField === 'description' ? '…' : t('aiShorten')}
                    </button>
                    <button
                      type="button"
                      disabled={!description.trim() || aiLoadingField !== null || !token}
                      className={aiBtn}
                      onClick={() => runAi('description', 'translate_en', description, setDescription)}
                    >
                      {aiLoadingField === 'description' ? '…' : t('aiTranslateEn')}
                    </button>
                    <button
                      type="button"
                      disabled={!description.trim() || aiLoadingField !== null || !token}
                      className={aiBtn}
                      onClick={() => runAi('description', 'translate_ar', description, setDescription)}
                    >
                      {aiLoadingField === 'description' ? '…' : t('aiTranslateAr')}
                    </button>
                  </div>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                  rows={3}
                  placeholder={t('taskDescription')}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('taskCustomerNameLabel')}</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={inputCls}
                  placeholder={t('taskCustomerNamePlaceholder')}
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('taskCustomerNameHint')}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('taskRegisteredClientLabel')}</label>
                <select
                  value={clientId ?? ''}
                  onChange={(e) => setClientId(e.target.value || null)}
                  className={inputCls}
                >
                  <option value="">{t('selectRegisteredClientOptional')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` — ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('taskRegisteredClientHint')}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('taskCustomerPhoneLabel')}</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={inputCls}
                  placeholder={t('taskCustomerPhonePlaceholder')}
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('taskCustomerPhoneHint')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('dueDate')}</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('orderReference')}</label>
                  <input
                    type="text"
                    value={orderReference}
                    onChange={(e) => setOrderReference(e.target.value)}
                    className={inputCls}
                    placeholder={t('orderReference')}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('attachOrder')}</label>
                <select value={orderId ?? ''} onChange={(e) => setOrderId(e.target.value || null)} className={inputCls}>
                  <option value="">{t('selectOrder')}</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.customerReference || o.id} ({o.items.length} {t('items')})
                    </option>
                  ))}
                </select>
                {orders.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('noOrdersForTask')}</p>
                )}
              </div>

              {isEdit && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('statusCol')}</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition ${
                          status === s
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {t(STATUS_LABELS[s] as Parameters<typeof t>[0])}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('assignees')}</label>
                <div className="flex gap-4">
                  <div className="w-48 shrink-0 space-y-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">My team</p>
                    {availableEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, emp.id)}
                        className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm active:cursor-grabbing active:opacity-60 dark:border-slate-600 dark:bg-slate-700"
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(emp.id)}`}
                        >
                          {initials(emp.name)}
                        </div>
                        <span className="truncate">{emp.name}</span>
                      </div>
                    ))}
                    {availableEmployees.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">All selected</p>}
                  </div>
                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`min-h-[120px] flex-1 rounded-xl border-2 border-dashed p-3 transition ${
                      dragOver
                        ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <p className="mb-2 text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">{t('assignees')}</p>
                    {dragOver && (
                      <p className="mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">{t('dropHereToAddAssignee')}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {assigneeUsers.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 py-1 pl-1.5 pr-2 text-sm dark:bg-slate-600 dark:text-slate-200"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(u.id)}`}
                          >
                            {initials(u.name)}
                          </span>
                          {u.name}
                          <button
                            type="button"
                            onClick={() => removeAssignee(u.id)}
                            className="rounded-full p-0.5 text-slate-500 hover:bg-slate-300 hover:text-slate-700 dark:hover:bg-slate-500 dark:hover:text-slate-200"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                    {assigneeUsers.length === 0 && !dragOver && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{t('dropHereToAddAssignee')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-700 sm:flex-row sm:flex-wrap">
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => setEditStockOpen(true)}
                    className="order-first w-full rounded-lg border-2 border-indigo-300 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/70 sm:order-0 sm:w-auto sm:px-4"
                  >
                    {t('taskOpenStockReceipt')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || assigneeIds.length === 0}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : isEdit ? (
                    t('saveChanges')
                  ) : (
                    t('taskSaveAndContinueProducts')
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
