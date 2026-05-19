import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiClient, ApiTask } from '../../services/api';
import { clientsApi, tasksApi } from '../../services/api';
import { useStorehouse } from '../../hooks/useStorehouse';

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

type Hardware = {
  hinges: boolean;
  handle: boolean;
  lock: boolean;
  closer: boolean;
  panicBar: boolean;
  slidingWheels: boolean;
  cylinder: boolean;
  magnet: boolean;
};

type ProductSpec = {
  productType: string;
  system: string;
  width: string;
  height: string;
  depth: string;
  unit: 'cm' | 'mm' | 'in';
  quantity: string;
  frameProfile: string;
  frameMaterial: string;
  frameThickness: string;
  frameColor: string;
  frameFinish: string;
  glassType: string;
  glassThickness: string;
  glassTint: string;
  hardware: Hardware;
  productionNotes: string;
};

const EMPTY_SPEC: ProductSpec = {
  productType: '',
  system: '',
  width: '',
  height: '',
  depth: '',
  unit: 'cm',
  quantity: '1',
  frameProfile: '',
  frameMaterial: '',
  frameThickness: '',
  frameColor: '',
  frameFinish: '',
  glassType: '',
  glassThickness: '',
  glassTint: '',
  hardware: {
    hinges: false, handle: false, lock: false, closer: false,
    panicBar: false, slidingWheels: false, cylinder: false, magnet: false,
  },
  productionNotes: '',
};

const CUSTOM_TITLE_PREFIX = 'Custom order:';

/**
 * Serialise the structured ProductSpec into a human-readable description block
 * that lives on Task.description. We intentionally render this as plain text
 * (not JSON) so anyone viewing the task — supervisor, employee, accountant —
 * gets a clean, printable spec sheet without needing a custom renderer.
 *
 * Sections with no values are skipped entirely so a sparsely-filled spec
 * doesn't look like a wall of "—" placeholders.
 */
function buildDescription(
  brief: string,
  spec: ProductSpec,
  estimatedPrice: string,
  deliveryAddress: string,
  labels: {
    productSection: string; type: string; system: string;
    dimensions: string; width: string; height: string; depth: string; quantity: string;
    frame: string; frameProfile: string; frameMaterial: string; frameThickness: string; frameColor: string; frameFinish: string;
    glass: string; glassType: string; glassThickness: string; glassTint: string;
    hardware: string; hardwareNames: Record<keyof Hardware, string>;
    notes: string;
    estimatedPrice: string; delivery: string;
  },
): string {
  const out: string[] = [];
  if (brief.trim()) out.push(brief.trim());

  const dim: string[] = [];
  if (spec.width.trim())  dim.push(`${labels.width}: ${spec.width.trim()} ${spec.unit}`);
  if (spec.height.trim()) dim.push(`${labels.height}: ${spec.height.trim()} ${spec.unit}`);
  if (spec.depth.trim())  dim.push(`${labels.depth}: ${spec.depth.trim()} ${spec.unit}`);
  if (spec.quantity.trim() && spec.quantity.trim() !== '1') dim.push(`${labels.quantity}: ${spec.quantity.trim()}`);

  const productLines: string[] = [];
  if (spec.productType.trim()) productLines.push(`• ${labels.type}: ${spec.productType.trim()}`);
  if (spec.system.trim())      productLines.push(`• ${labels.system}: ${spec.system.trim()}`);

  const frameLines: string[] = [];
  if (spec.frameProfile.trim())   frameLines.push(`• ${labels.frameProfile}: ${spec.frameProfile.trim()}`);
  if (spec.frameMaterial.trim())  frameLines.push(`• ${labels.frameMaterial}: ${spec.frameMaterial.trim()}`);
  if (spec.frameThickness.trim()) frameLines.push(`• ${labels.frameThickness}: ${spec.frameThickness.trim()} mm`);
  if (spec.frameColor.trim())     frameLines.push(`• ${labels.frameColor}: ${spec.frameColor.trim()}`);
  if (spec.frameFinish.trim())    frameLines.push(`• ${labels.frameFinish}: ${spec.frameFinish.trim()}`);

  const glassLines: string[] = [];
  if (spec.glassType.trim())      glassLines.push(`• ${labels.glassType}: ${spec.glassType.trim()}`);
  if (spec.glassThickness.trim()) glassLines.push(`• ${labels.glassThickness}: ${spec.glassThickness.trim()}`);
  if (spec.glassTint.trim())      glassLines.push(`• ${labels.glassTint}: ${spec.glassTint.trim()}`);

  const enabledHardware = (Object.entries(spec.hardware) as [keyof Hardware, boolean][])
    .filter(([, on]) => on)
    .map(([key]) => labels.hardwareNames[key]);

  const pushSection = (heading: string, lines: string[]) => {
    if (lines.length === 0) return;
    out.push('');
    out.push(`— ${heading} —`);
    lines.forEach((l) => out.push(l));
  };

  pushSection(labels.productSection, productLines);
  if (dim.length > 0) {
    out.push('');
    out.push(`— ${labels.dimensions} —`);
    out.push(dim.join('  ·  '));
  }
  pushSection(labels.frame, frameLines);
  pushSection(labels.glass, glassLines);
  if (enabledHardware.length > 0) {
    out.push('');
    out.push(`— ${labels.hardware} —`);
    out.push(enabledHardware.map((h) => `✓ ${h}`).join('   '));
  }
  if (spec.productionNotes.trim()) {
    out.push('');
    out.push(`— ${labels.notes} —`);
    out.push(spec.productionNotes.trim());
  }

  if (estimatedPrice.trim()) {
    out.push('');
    out.push(`• ${labels.estimatedPrice}: ${estimatedPrice.trim()} ILS`);
  }
  if (deliveryAddress.trim()) {
    out.push('');
    out.push(`— ${labels.delivery} —`);
    out.push(deliveryAddress.trim());
  }
  return out.join('\n').trim();
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
  const [spec, setSpec] = useState<ProductSpec>(EMPTY_SPEC);

  const [clients, setClients] = useState<ApiClient[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull real catalog colors so the Frame Color field can be a true datalist
  // backed by what the storehouse actually carries — supervisor can still type
  // a free-form color if needed.
  const { colors: catalogColors } = useStorehouse();

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

  const patchSpec = (patch: Partial<ProductSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const toggleHardware = (key: keyof Hardware) =>
    setSpec((s) => ({ ...s, hardware: { ...s.hardware, [key]: !s.hardware[key] } }));

  const sectionFilled = useMemo(
    () => ({
      product: Boolean(spec.productType || spec.system),
      dimensions: Boolean(spec.width || spec.height || spec.depth || (spec.quantity && spec.quantity !== '1')),
      frame: Boolean(spec.frameProfile || spec.frameMaterial || spec.frameThickness || spec.frameColor || spec.frameFinish),
      glass: Boolean(spec.glassType || spec.glassThickness || spec.glassTint),
      hardware: Object.values(spec.hardware).some(Boolean),
      notes: Boolean(spec.productionNotes.trim()),
    }),
    [spec],
  );

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
    () =>
      buildDescription(brief, spec, estimatedPrice, deliveryAddress, {
        productSection: t('customOrderPkgProductSection'),
        type: t('customOrderPkgProductType'),
        system: t('customOrderPkgProductSystem'),
        dimensions: t('customOrderPkgDimensionsSection'),
        width: t('customOrderPkgWidth'),
        height: t('customOrderPkgHeight'),
        depth: t('customOrderPkgDepth'),
        quantity: t('customOrderPkgQuantity'),
        frame: t('customOrderPkgFrameSection'),
        frameProfile: t('customOrderPkgFrameProfile'),
        frameMaterial: t('customOrderPkgFrameMaterial'),
        frameThickness: t('customOrderPkgFrameThickness'),
        frameColor: t('customOrderPkgFrameColor'),
        frameFinish: t('customOrderPkgFrameFinish'),
        glass: t('customOrderPkgGlassSection'),
        glassType: t('customOrderPkgGlassType'),
        glassThickness: t('customOrderPkgGlassThickness'),
        glassTint: t('customOrderPkgGlassTint'),
        hardware: t('customOrderPkgHardwareSection'),
        hardwareNames: {
          hinges: t('customOrderPkgHardwareHinges'),
          handle: t('customOrderPkgHardwareHandle'),
          lock: t('customOrderPkgHardwareLock'),
          closer: t('customOrderPkgHardwareCloser'),
          panicBar: t('customOrderPkgHardwarePanicBar'),
          slidingWheels: t('customOrderPkgHardwareSlidingWheels'),
          cylinder: t('customOrderPkgHardwareCylinder'),
          magnet: t('customOrderPkgHardwareMagnet'),
        },
        notes: t('customOrderPkgNotesSection'),
        estimatedPrice: t('customOrderEstimatedPriceLabel'),
        delivery: t('customOrderDeliveryAddressLabel'),
      }),
    [brief, spec, estimatedPrice, deliveryAddress, t],
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

          {/* Section 3 — Complete product specification */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {t('customOrderSectionSpecs')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('customOrderPackageHint')}</p>
            </div>

            <div className="space-y-3">
              {/* Product type */}
              <SpecGroup
                title={t('customOrderPkgProductSection')}
                filled={sectionFilled.product}
                completedLabel={t('customOrderPkgSectionCompleted')}
                emptyLabel={t('customOrderPkgSectionEmpty')}
                accent="indigo"
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5M9 12h1.5m-1.5 5.25h1.5m3-10.5H15m-1.5 5.25H15m-1.5 5.25H15" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField
                    label={t('customOrderPkgProductType')}
                    value={spec.productType}
                    onChange={(v) => patchSpec({ productType: v })}
                    inputCls={inputCls}
                    options={[
                      ['', '—'],
                      [t('customOrderPkgProductTypeWindow'), t('customOrderPkgProductTypeWindow')],
                      [t('customOrderPkgProductTypeDoor'), t('customOrderPkgProductTypeDoor')],
                      [t('customOrderPkgProductTypeCurtainWall'), t('customOrderPkgProductTypeCurtainWall')],
                      [t('customOrderPkgProductTypeShutter'), t('customOrderPkgProductTypeShutter')],
                      [t('customOrderPkgProductTypePartition'), t('customOrderPkgProductTypePartition')],
                      [t('customOrderPkgProductTypeOther'), t('customOrderPkgProductTypeOther')],
                    ]}
                  />
                  <SelectField
                    label={t('customOrderPkgProductSystem')}
                    value={spec.system}
                    onChange={(v) => patchSpec({ system: v })}
                    inputCls={inputCls}
                    options={[
                      ['', '—'],
                      [t('customOrderPkgSystemSliding'), t('customOrderPkgSystemSliding')],
                      [t('customOrderPkgSystemHinged'), t('customOrderPkgSystemHinged')],
                      [t('customOrderPkgSystemFixed'), t('customOrderPkgSystemFixed')],
                      [t('customOrderPkgSystemFolding'), t('customOrderPkgSystemFolding')],
                      [t('customOrderPkgSystemTiltTurn'), t('customOrderPkgSystemTiltTurn')],
                      [t('customOrderPkgSystemRolling'), t('customOrderPkgSystemRolling')],
                    ]}
                  />
                </div>
              </SpecGroup>

              {/* Dimensions */}
              <SpecGroup
                title={t('customOrderPkgDimensionsSection')}
                filled={sectionFilled.dimensions}
                completedLabel={t('customOrderPkgSectionCompleted')}
                emptyLabel={t('customOrderPkgSectionEmpty')}
                accent="sky"
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 16.5h18M7.5 3v18M16.5 3v18" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <NumberField label={t('customOrderPkgWidth')}  value={spec.width}  onChange={(v) => patchSpec({ width: v })}  inputCls={inputCls} />
                  <NumberField label={t('customOrderPkgHeight')} value={spec.height} onChange={(v) => patchSpec({ height: v })} inputCls={inputCls} />
                  <NumberField label={t('customOrderPkgDepth')}  value={spec.depth}  onChange={(v) => patchSpec({ depth: v })}  inputCls={inputCls} />
                  <SelectField
                    label={t('customOrderPkgUnit')}
                    value={spec.unit}
                    onChange={(v) => patchSpec({ unit: (v || 'cm') as ProductSpec['unit'] })}
                    inputCls={inputCls}
                    options={[
                      ['cm', t('customOrderPkgUnitCm')],
                      ['mm', t('customOrderPkgUnitMm')],
                      ['in', t('customOrderPkgUnitInch')],
                    ]}
                  />
                  <NumberField label={t('customOrderPkgQuantity')} value={spec.quantity} onChange={(v) => patchSpec({ quantity: v })} inputCls={inputCls} min={1} />
                </div>
              </SpecGroup>

              {/* Frame */}
              <SpecGroup
                title={t('customOrderPkgFrameSection')}
                filled={sectionFilled.frame}
                completedLabel={t('customOrderPkgSectionCompleted')}
                emptyLabel={t('customOrderPkgSectionEmpty')}
                accent="emerald"
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18v15H3zM3 8.25h18M3 15.75h18M7.5 4.5v15M16.5 4.5v15" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('customOrderPkgFrameProfile')}
                    </label>
                    <input
                      type="text"
                      value={spec.frameProfile}
                      onChange={(e) => patchSpec({ frameProfile: e.target.value })}
                      className={inputCls}
                      placeholder={t('customOrderPkgFrameProfilePlaceholder')}
                    />
                  </div>
                  <SelectField
                    label={t('customOrderPkgFrameMaterial')}
                    value={spec.frameMaterial}
                    onChange={(v) => patchSpec({ frameMaterial: v })}
                    inputCls={inputCls}
                    options={[
                      ['', '—'],
                      [t('customOrderPkgFrameMaterialAluminum'), t('customOrderPkgFrameMaterialAluminum')],
                      [t('customOrderPkgFrameMaterialUpvc'), t('customOrderPkgFrameMaterialUpvc')],
                      [t('customOrderPkgFrameMaterialSteel'), t('customOrderPkgFrameMaterialSteel')],
                      [t('customOrderPkgFrameMaterialWood'), t('customOrderPkgFrameMaterialWood')],
                    ]}
                  />
                  <NumberField label={t('customOrderPkgFrameThickness')} value={spec.frameThickness} onChange={(v) => patchSpec({ frameThickness: v })} inputCls={inputCls} step="0.1" />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('customOrderPkgFrameColor')}
                    </label>
                    <input
                      type="text"
                      list="custom-order-color-list"
                      value={spec.frameColor}
                      onChange={(e) => patchSpec({ frameColor: e.target.value })}
                      className={inputCls}
                      placeholder={t('customOrderPkgFrameColorPlaceholder')}
                    />
                    <datalist id="custom-order-color-list">
                      {catalogColors.map((c) => (
                        <option key={c.colorCode} value={`${c.name} (${c.colorCode})`} />
                      ))}
                    </datalist>
                  </div>
                  <SelectField
                    label={t('customOrderPkgFrameFinish')}
                    value={spec.frameFinish}
                    onChange={(v) => patchSpec({ frameFinish: v })}
                    inputCls={inputCls}
                    options={[
                      ['', '—'],
                      [t('customOrderPkgFinishPowderCoat'), t('customOrderPkgFinishPowderCoat')],
                      [t('customOrderPkgFinishAnodized'), t('customOrderPkgFinishAnodized')],
                      [t('customOrderPkgFinishWoodGrain'), t('customOrderPkgFinishWoodGrain')],
                      [t('customOrderPkgFinishRal'), t('customOrderPkgFinishRal')],
                      [t('customOrderPkgFinishMillFinish'), t('customOrderPkgFinishMillFinish')],
                    ]}
                  />
                </div>
              </SpecGroup>

              {/* Glass */}
              <SpecGroup
                title={t('customOrderPkgGlassSection')}
                filled={sectionFilled.glass}
                completedLabel={t('customOrderPkgSectionCompleted')}
                emptyLabel={t('customOrderPkgSectionEmpty')}
                accent="cyan"
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h15v15h-15zM4.5 9.75h15M4.5 14.25h15M9.75 4.5v15M14.25 4.5v15" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectField
                    label={t('customOrderPkgGlassType')}
                    value={spec.glassType}
                    onChange={(v) => patchSpec({ glassType: v })}
                    inputCls={inputCls}
                    options={[
                      ['', '—'],
                      [t('customOrderPkgGlassTypeNone'), t('customOrderPkgGlassTypeNone')],
                      [t('customOrderPkgGlassTypeSingle'), t('customOrderPkgGlassTypeSingle')],
                      [t('customOrderPkgGlassTypeDouble'), t('customOrderPkgGlassTypeDouble')],
                      [t('customOrderPkgGlassTypeTriple'), t('customOrderPkgGlassTypeTriple')],
                      [t('customOrderPkgGlassTypeTempered'), t('customOrderPkgGlassTypeTempered')],
                      [t('customOrderPkgGlassTypeLaminated'), t('customOrderPkgGlassTypeLaminated')],
                    ]}
                  />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('customOrderPkgGlassThickness')}
                    </label>
                    <input
                      type="text"
                      value={spec.glassThickness}
                      onChange={(e) => patchSpec({ glassThickness: e.target.value })}
                      className={inputCls}
                      placeholder={t('customOrderPkgGlassThicknessPlaceholder')}
                    />
                  </div>
                  <SelectField
                    label={t('customOrderPkgGlassTint')}
                    value={spec.glassTint}
                    onChange={(v) => patchSpec({ glassTint: v })}
                    inputCls={inputCls}
                    options={[
                      ['', '—'],
                      [t('customOrderPkgGlassTintClear'), t('customOrderPkgGlassTintClear')],
                      [t('customOrderPkgGlassTintBronze'), t('customOrderPkgGlassTintBronze')],
                      [t('customOrderPkgGlassTintGrey'), t('customOrderPkgGlassTintGrey')],
                      [t('customOrderPkgGlassTintReflective'), t('customOrderPkgGlassTintReflective')],
                      [t('customOrderPkgGlassTintFrosted'), t('customOrderPkgGlassTintFrosted')],
                    ]}
                  />
                </div>
              </SpecGroup>

              {/* Hardware */}
              <SpecGroup
                title={t('customOrderPkgHardwareSection')}
                filled={sectionFilled.hardware}
                completedLabel={t('customOrderPkgSectionCompleted')}
                emptyLabel={t('customOrderPkgSectionEmpty')}
                accent="amber"
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(spec.hardware) as (keyof Hardware)[]).map((key) => {
                    const labelMap: Record<keyof Hardware, string> = {
                      hinges: t('customOrderPkgHardwareHinges'),
                      handle: t('customOrderPkgHardwareHandle'),
                      lock: t('customOrderPkgHardwareLock'),
                      closer: t('customOrderPkgHardwareCloser'),
                      panicBar: t('customOrderPkgHardwarePanicBar'),
                      slidingWheels: t('customOrderPkgHardwareSlidingWheels'),
                      cylinder: t('customOrderPkgHardwareCylinder'),
                      magnet: t('customOrderPkgHardwareMagnet'),
                    };
                    const on = spec.hardware[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleHardware(key)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          on
                            ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-amber-700 dark:hover:bg-amber-950/20'
                        }`}
                        aria-pressed={on}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 dark:border-slate-500'}`}>
                          {on && (
                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.005L3.29 9.83a1 1 0 1 1 1.42-1.408l3.793 3.83 6.79-6.881a1 1 0 0 1 1.41-.082Z" clipRule="evenodd" /></svg>
                          )}
                        </span>
                        <span className="truncate">{labelMap[key]}</span>
                      </button>
                    );
                  })}
                </div>
              </SpecGroup>

              {/* Production notes */}
              <SpecGroup
                title={t('customOrderPkgNotesSection')}
                filled={sectionFilled.notes}
                completedLabel={t('customOrderPkgSectionCompleted')}
                emptyLabel={t('customOrderPkgSectionEmpty')}
                accent="violet"
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.8a2.121 2.121 0 1 1 3 3L19.862 7.487M16.862 4.487 9 12.349V15h2.652l7.21-7.213M16.862 4.487l3 3M4.5 19.5h15" />
                  </svg>
                }
              >
                <textarea
                  value={spec.productionNotes}
                  onChange={(e) => patchSpec({ productionNotes: e.target.value })}
                  rows={3}
                  className={inputCls}
                  placeholder={t('customOrderPkgNotesPlaceholder')}
                />
              </SpecGroup>
            </div>

            {description && (
              <details className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer font-medium">{t('customOrderPreviewDescription')}</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
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

// ── Local helpers for the structured spec UI ───────────────────────────────

type AccentName = 'indigo' | 'sky' | 'emerald' | 'cyan' | 'amber' | 'violet';

const ACCENT_STYLES: Record<AccentName, { badgeOn: string; badgeOff: string; iconWrap: string; ring: string }> = {
  indigo:  { badgeOn: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200',   badgeOff: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', iconWrap: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',   ring: 'ring-indigo-200 dark:ring-indigo-900' },
  sky:     { badgeOn: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',               badgeOff: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', iconWrap: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',             ring: 'ring-sky-200 dark:ring-sky-900' },
  emerald: { badgeOn: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200', badgeOff: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', iconWrap: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-900' },
  cyan:    { badgeOn: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200',           badgeOff: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', iconWrap: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',           ring: 'ring-cyan-200 dark:ring-cyan-900' },
  amber:   { badgeOn: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',       badgeOff: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', iconWrap: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',       ring: 'ring-amber-200 dark:ring-amber-900' },
  violet:  { badgeOn: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',   badgeOff: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', iconWrap: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',     ring: 'ring-violet-200 dark:ring-violet-900' },
};

const SpecGroup: React.FC<{
  title: string;
  filled: boolean;
  completedLabel: string;
  emptyLabel: string;
  accent: AccentName;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, filled, completedLabel, emptyLabel, accent, icon, children }) => {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ring-1 dark:border-slate-700 dark:bg-slate-800/60 ${filled ? styles.ring : 'ring-transparent'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.iconWrap}`}>{icon}</span>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${filled ? styles.badgeOn : styles.badgeOff}`}>
          {filled ? completedLabel : emptyLabel}
        </span>
      </div>
      {children}
    </div>
  );
};

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
  options: [string, string][];
}> = ({ label, value, onChange, inputCls, options }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map(([val, lbl]) => (
        <option key={val} value={val}>{lbl}</option>
      ))}
    </select>
  </div>
);

const NumberField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
  min?: number;
  step?: string;
}> = ({ label, value, onChange, inputCls, min, step }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      min={min}
      step={step}
      placeholder="—"
    />
  </div>
);
