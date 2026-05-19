import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiClient, ApiTask } from '../../services/api';
import { clientsApi, tasksApi } from '../../services/api';

const COLORS = [
  'bg-blue-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-pink-500',
];
const avatarColor = (id: string) =>
  COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

type SavePayload = {
  assignee_ids: string[];
  title: string;
  description?: string | null;
  due_date?: string | null;
  order_reference?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  client_id?: string | null;
};

type Props = {
  employees: User[];
  onSave: (payload: SavePayload) => Promise<ApiTask | undefined>;
  onClose: () => void;
};

type SpecRow = { label: string; value: string };

const CUSTOM_TITLE_PREFIX = 'Custom order:';

function buildDescription(
  brief: string,
  specs: SpecRow[],
  estimatedPrice: string,
  deliveryAddress: string,
): string {
  const lines: string[] = [];
  if (brief.trim()) {
    lines.push(brief.trim());
  }
  const cleanedSpecs = specs.filter((s) => s.value.trim());
  if (cleanedSpecs.length > 0) {
    lines.push('');
    lines.push('— Custom specifications —');
    cleanedSpecs.forEach((s) => {
      const label = s.label.trim() || '(unnamed)';
      const value = s.value.trim() || '—';
      lines.push(`• ${label}: ${value}`);
    });
  }
  if (estimatedPrice.trim()) {
    lines.push('');
    lines.push(`• Estimated price: ${estimatedPrice.trim()} ILS`);
  }
  if (deliveryAddress.trim()) {
    lines.push('');
    lines.push('— Delivery / installation address —');
    lines.push(deliveryAddress.trim());
  }
  return lines.join('\n').trim();
}

export const CustomOrderModal: React.FC<Props> = ({ employees, onSave, onClose }) => {
  const { t, token } = useApp();

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specs, setSpecs] = useState<SpecRow[]>([
    { label: t('customOrderSpecProfile'),    value: '' },
    { label: t('customOrderSpecDimensions'), value: '' },
    { label: t('customOrderSpecMaterial'),   value: '' },
    { label: t('customOrderSpecThickness'),  value: '' },
    { label: t('customOrderSpecColor'),      value: '' },
    { label: t('customOrderSpecFinish'),     value: '' },
    { label: t('customOrderSpecGlassType'),  value: '' },
    { label: t('customOrderSpecQuantity'),   value: '' },
  ]);

  const [clients, setClients] = useState<ApiClient[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void clientsApi
      .list(token)
      .then((rows) => setClients(rows))
      .catch(() => setClients([]));
  }, [token]);

  const availableEmployees = useMemo(
    () => employees.filter((e) => !assigneeIds.includes(e.id)),
    [employees, assigneeIds],
  );
  const assigneeUsers = useMemo(
    () => assigneeIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean) as User[],
    [assigneeIds, employees],
  );

  const updateSpec = (idx: number, patch: Partial<SpecRow>) => {
    setSpecs((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addSpec = () => setSpecs((rows) => [...rows, { label: '', value: '' }]);
  const removeSpec = (idx: number) => setSpecs((rows) => rows.filter((_, i) => i !== idx));

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
  const removeAssignee = (id: string) => setAssigneeIds((prev) => prev.filter((x) => x !== id));

  const finalTitle = useMemo(() => {
    const raw = title.trim();
    if (!raw) return '';
    if (raw.toLowerCase().startsWith(CUSTOM_TITLE_PREFIX.toLowerCase())) return raw;
    return `${CUSTOM_TITLE_PREFIX} ${raw}`;
  }, [title]);

  const description = useMemo(
    () => buildDescription(brief, specs, estimatedPrice, deliveryAddress),
    [brief, specs, estimatedPrice, deliveryAddress],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || assigneeIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await onSave({
        assignee_ids: assigneeIds,
        title: finalTitle,
        description: description || null,
        due_date: dueDate.trim() || null,
        order_reference: orderReference.trim() || null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        client_id: clientId,
      });
      if (saved) {
        // Upload any selected attachments serially. Partial failures don't roll back
        // the task — surface a warning and close so the supervisor can retry from
        // the task detail view instead of losing the whole order.
        if (attachments.length > 0) {
          let anyFailed = false;
          for (const file of attachments) {
            try {
              await tasksApi.uploadAttachment(saved.id, file, token);
            } catch {
              anyFailed = true;
            }
          }
          if (anyFailed) {
            setError(t('customOrderAttachmentsPartialFail'));
            setSaving(false);
            return;
          }
        }
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setAttachments((prev) => [...prev, ...picked]);
    // Reset so the user can re-select the same file if they remove it then change their mind.
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-800 sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl">
        {/* Header — gradient to distinguish from the standard task modal */}
        <div className="flex shrink-0 items-start justify-between gap-4 bg-linear-to-r from-violet-600 via-fuchsia-500 to-rose-500 px-6 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 0 0-3.09 3.091ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                {t('customOrderBadge')}
              </p>
              <h2 className="text-lg font-bold leading-tight">{t('customOrderTitle')}</h2>
              <p className="text-xs text-white/80">{t('customOrderSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-1.5 text-white/90 transition hover:bg-white/20"
            aria-label={t('close')}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Section 1 — Order summary */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('customOrderSectionSummary')}
            </h3>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('customOrderTitleLabel')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                  placeholder={t('customOrderTitlePlaceholder')}
                  required
                />
                {title.trim() && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {t('customOrderTitlePreview')}: <span className="font-mono">{finalTitle}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('customOrderBriefLabel')}
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={2}
                  className={inputCls}
                  placeholder={t('customOrderBriefPlaceholder')}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('customOrderEstimatedPriceLabel')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  className={inputCls}
                  placeholder={t('customOrderEstimatedPricePlaceholder')}
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('customOrderEstimatedPriceCurrencyHint')}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('customOrderDeliveryAddressLabel')}
                </label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  className={inputCls}
                  placeholder={t('customOrderDeliveryAddressPlaceholder')}
                />
              </div>
            </div>
          </section>

          {/* Section 2 — Customer */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('customOrderSectionCustomer')}
            </h3>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('taskRegisteredClientLabel')}
                </label>
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
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('taskCustomerNameLabel')}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={inputCls}
                    placeholder={t('taskCustomerNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('taskCustomerPhoneLabel')}
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={inputCls}
                    placeholder={t('taskCustomerPhonePlaceholder')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 — Specs */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {t('customOrderSectionSpecs')}
              </h3>
              <button
                type="button"
                onClick={addSpec}
                className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/70"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                {t('customOrderAddSpec')}
              </button>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              {specs.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('customOrderNoSpecs')}</p>
              )}
              {specs.map((s, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateSpec(idx, { label: e.target.value })}
                    className={inputCls}
                    placeholder={t('customOrderSpecLabelPlaceholder')}
                  />
                  <input
                    type="text"
                    value={s.value}
                    onChange={(e) => updateSpec(idx, { value: e.target.value })}
                    className={inputCls}
                    placeholder={t('customOrderSpecValuePlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => removeSpec(idx)}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {description && (
              <details className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer font-medium">{t('customOrderPreviewDescription')}</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
{description}
                </pre>
              </details>
            )}
          </section>

          {/* Section 3b — Attachments */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {t('customOrderSectionAttachments')}
              </h3>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/70"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                {t('customOrderAttachmentsAddButton')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleFilesPicked}
                className="hidden"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('customOrderAttachmentsHint')}
              </p>
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('customOrderAttachmentsEmpty')}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {attachments.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700/60"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {file.name}
                        <span className="ms-2 text-[10px] text-slate-500 dark:text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="rounded border border-rose-200 px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        {t('customOrderAttachmentRemove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Section 4 — Assignees */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('customOrderSectionAssignees')}
            </h3>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex gap-4">
                <div className="w-48 shrink-0 space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                    {t('customOrderTeamHeading')}
                  </p>
                  {availableEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, emp.id)}
                      onClick={() =>
                        setAssigneeIds((prev) => (prev.includes(emp.id) ? prev : [...prev, emp.id]))
                      }
                      className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm transition hover:border-violet-300 active:cursor-grabbing active:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-violet-700"
                    >
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(emp.id)}`}>
                        {initials(emp.name)}
                      </div>
                      <span className="truncate">{emp.name}</span>
                    </div>
                  ))}
                  {availableEmployees.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t('customOrderAllAssigned')}</p>
                  )}
                </div>
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`min-h-[120px] flex-1 rounded-xl border-2 border-dashed p-3 transition ${
                    dragOver
                      ? 'border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                    {t('assignees')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assigneeUsers.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 py-1 pl-1.5 pr-2 text-sm text-violet-900 dark:bg-violet-900/40 dark:text-violet-100"
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor(u.id)}`}>
                          {initials(u.name)}
                        </span>
                        {u.name}
                        <button
                          type="button"
                          onClick={() => removeAssignee(u.id)}
                          className="rounded-full p-0.5 text-violet-700 hover:bg-violet-200 dark:text-violet-200 dark:hover:bg-violet-800"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  {assigneeUsers.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t('dropHereToAddAssignee')}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-700 sm:flex-row">
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
              className="flex-1 rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/30 transition hover:from-violet-500 hover:to-fuchsia-400 disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {attachments.length > 0 && (
                    <span className="text-xs">{t('customOrderAttachmentsUploading')}</span>
                  )}
                </span>
              ) : (
                t('customOrderCreate')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
