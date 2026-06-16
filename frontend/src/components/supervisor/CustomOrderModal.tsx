import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { TKey } from '../../i18n/translations';
import type { User } from '../../types/user';
import type { ApiClient, ApiTask } from '../../services/api';
import { clientsApi, tasksApi } from '../../services/api';
import { CustomOrderInvoiceModal } from './CustomOrderInvoiceModal';
import {
  buildOrderDescription,
  CUSTOM_ORDER_TITLE_PREFIX,
  EMPTY_CARD,
  type CardLabels,
  type CustomOrderCard,
  type FillingOption,
  type ProductType,
} from './customOrderTypes';

const COLORS = [
  'bg-blue-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
  'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-rose-500', 'bg-pink-500',
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
  total_amount?: number | null;
  amount_paid?: number | null;
};

type Props = {
  employees: User[];
  onSave: (payload: SavePayload) => Promise<ApiTask | undefined>;
  onClose: () => void;
};

// ── Static option lists fed by i18n at render time ────────────────────────

const PRODUCT_TYPES: ProductType[] = [
  'window', 'aluminum_door', 'glass_door', 'glass_facade',
  'canopy', 'glass_partition', 'mesh_door', 'cabinet', 'aluminum_kitchen',
];

const WINDOW_SYSTEMS = ['sliding', 'hinged', 'fixed', 'folding', 'tilt_turn'] as const;
const DOOR_SYSTEMS = ['sliding_door', 'hinged_door', 'pivot', 'folding_door'] as const;
const GENERIC_SYSTEMS = ['45_90', 'european', 'japanese'] as const;

const DOOR_LIKE: ProductType[] = ['aluminum_door', 'glass_door', 'mesh_door'];

const FRAME_TYPES = ['single', 'double', 'hidden_sash', 'frameless'] as const;
const FRAME_COLORS = [
  'natural_silver', 'white', 'matte_black', 'gold', 'bronze',
  'dark_grey', 'wood_brown', 'pearl_white', 'titanium',
] as const;

const SHEET_TYPES = [
  'aluminum_sheet', 'aluminum_panel', 'compressed', 'wood_panel', 'insulated',
] as const;
const SHEET_COLORS = [
  'silver', 'white', 'black', 'bronze', 'gold', 'grey', 'wood', 'beige',
] as const;

const GLASS_TYPES = [
  'normal', 'double_dgu', 'triple_tgu', 'tempered', 'laminated', 'low_e', 'smart',
] as const;
const GLASS_THICKNESSES = [
  '4mm', '5mm', '6mm', '8mm', '10mm', '12mm', '6plus6', '8plus8',
] as const;
const GLASS_TINTS = [
  'clear', 'whitened', 'bronze', 'grey', 'green', 'blue', 'black',
] as const;
const GLASS_SHADES = ['none', '20', '30', '40', '50'] as const;

const LOCK_TYPES = ['standard', 'with_key', 'magnetic', 'digital'] as const;
const HANDLE_TYPES = ['standard', 'european', 'japanese', 'italian'] as const;
const HINGE_TYPES = ['standard', 'hidden', 'arm', 'soft_close'] as const;
const OPEN_DIRECTIONS = ['right', 'left', 'inward', 'outward', 'sliding'] as const;

const ACCESSORY_KEYS = [
  'slidingWheels', 'thermalInsulation', 'acousticInsulation', 'insectMesh',
  'softClose', 'siliconeTouch', 'waterSeal', 'dustSeal',
  'ledLighting', 'smartLock', 'fingerprintLock', 'cabinetSystem', 'kitchenAccessories',
] as const;

// ── Component ─────────────────────────────────────────────────────────────

export const CustomOrderModal: React.FC<Props> = ({ employees, onSave, onClose }) => {
  const { t, lang } = useApp();
  const { token } = useApp();

  // ── Order-level state ────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const companyName = '';
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [amountPaidStr, setAmountPaidStr] = useState('');

  const [cards, setCards] = useState<CustomOrderCard[]>([]);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const [clients, setClients] = useState<ApiClient[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After successful save we keep the task ref for invoice modal
  const [savedTask, setSavedTask] = useState<ApiTask | null>(null);
  const [invoiceMode, setInvoiceMode] = useState<'employee' | 'customer' | null>(null);

  // Builder panel
  const [builderOpenForId, setBuilderOpenForId] = useState<string | null>(null);
  const [builderDraft, setBuilderDraft] = useState<CustomOrderCard | null>(null);

  useEffect(() => {
    if (!token) return;
    void clientsApi.list(token).then(setClients).catch(() => setClients([]));
  }, [token]);

  // ── Derived ──────────────────────────────────────────────────────────
  const finalTitle = useMemo(() => {
    const raw = title.trim();
    if (!raw) return '';
    if (raw.toLowerCase().startsWith(CUSTOM_ORDER_TITLE_PREFIX.toLowerCase())) return raw;
    return `${CUSTOM_ORDER_TITLE_PREFIX} ${raw}`;
  }, [title]);

  const totalQty = useMemo(
    () => cards.reduce((sum, c) => sum + (parseInt(c.spec.quantity || '0', 10) || 0), 0),
    [cards],
  );
  const totalPrice = useMemo(
    () => cards.reduce((sum, c) => sum + (parseFloat(c.estimatedPrice || '0') || 0), 0),
    [cards],
  );

  const availableEmployees = useMemo(
    () => employees.filter((e) => !assigneeIds.includes(e.id)),
    [employees, assigneeIds],
  );
  const selectedEmployees = useMemo(
    () => assigneeIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean) as User[],
    [assigneeIds, employees],
  );

  // ── Builder helpers ──────────────────────────────────────────────────
  const openBuilderForNew = () => {
    setBuilderDraft({ ...EMPTY_CARD, id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
    setBuilderOpenForId('__new__');
  };
  const openBuilderForEdit = (card: CustomOrderCard) => {
    setBuilderDraft({ ...card });
    setBuilderOpenForId(card.id);
  };
  const closeBuilder = () => {
    setBuilderOpenForId(null);
    setBuilderDraft(null);
  };
  const commitBuilder = (draft: CustomOrderCard) => {
    setCards((prev) => {
      const idx = prev.findIndex((c) => c.id === draft.id);
      if (idx === -1) return [...prev, draft];
      const next = prev.slice();
      next[idx] = draft;
      return next;
    });
    setExpandedCardIds((prev) => new Set(prev).add(draft.id));
    closeBuilder();
  };

  const duplicateCard = (card: CustomOrderCard) => {
    const copy: CustomOrderCard = {
      ...card,
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    setCards((prev) => [...prev, copy]);
    setExpandedCardIds((prev) => new Set(prev).add(copy.id));
  };
  const deleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  };
  const toggleCardExpanded = (cardId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  // ── Labels passed to text builder ────────────────────────────────────
  const labels: CardLabels = {
    productType: t('customOrderPkgProductType'),
    system: t('customOrderPkgProductSystem'),
    dimensions: t('customOrderPkgDimensionsSection'),
    width: t('customOrderPkgWidth'),
    height: t('customOrderPkgHeight'),
    quantity: t('customOrderPkgQuantity'),
    unit: t('customOrderPkgUnit'),
    filling: t('customOrderBuilderFilling'),
    frameType: t('customOrderPkgFrameTypeSection'),
    frameColor: t('customOrderPkgFrameColor'),
    sheet: t('customOrderBuilderSheet'),
    sheetType: t('customOrderPkgSheetType'),
    sheetColor: t('customOrderPkgSheetColor'),
    glass: t('customOrderPkgGlassSection'),
    glassType: t('customOrderPkgGlassType'),
    glassThickness: t('customOrderPkgGlassThickness'),
    glassTint: t('customOrderPkgGlassTint'),
    glassShade: t('customOrderPkgGlassShade'),
    accessories: t('customOrderPkgHardwareSection'),
    lockType: t('customOrderPkgLockType'),
    handleType: t('customOrderPkgHandleType'),
    hingeType: t('customOrderPkgHingeType'),
    openDirection: t('customOrderPkgOpenDirection'),
    notes: t('customOrderPkgNotesSection'),
    customer: t('customOrderSectionCustomer'),
    customerName: t('taskCustomerNameLabel'),
    customerPhone: t('taskCustomerPhoneLabel'),
    companyName: t('customOrderSectionCustomer'),
    deliveryAddress: t('customOrderDeliveryAddressLabel'),
    estimatedPrice: t('customOrderEstimatedPriceLabel'),
    productCards: t('customOrderInvoiceProductCards'),
    cardLabel: t('customOrderCardsCountBadge'),
  };

  const description = useMemo(
    () =>
      buildOrderDescription({
        brief,
        cards,
        customer: { name: customerName, phone: customerPhone, company: companyName },
        deliveryAddress,
        labels,
        productTypeLabel: (pt) => t(productTypeKey(pt)),
        systemLabel: (s) => t(systemKey(s)),
        fillingLabel: (f) => t(fillingKey(f)),
        frameTypeLabel: (ft) => t(frameTypeKey(ft)),
        frameColorLabel: (fc) => t(frameColorKey(fc)),
        sheetTypeLabel: (s) => t(sheetTypeKey(s)),
        sheetColorLabel: (s) => t(sheetColorKey(s)),
        glassTypeLabel: (g) => t(glassTypeKey(g)),
        glassThicknessLabel: (g) => t(glassThicknessKey(g)),
        glassTintLabel: (g) => t(glassTintKey(g)),
        glassShadeLabel: (g) => t(glassShadeKey(g)),
        lockTypeLabel: (g) => t(lockTypeKey(g)),
        handleTypeLabel: (g) => t(handleTypeKey(g)),
        hingeTypeLabel: (g) => t(hingeTypeKey(g)),
        openDirectionLabel: (g) => t(openDirectionKey(g)),
        accessoryLabel: (k) => t(accessoryKey(k)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brief, cards, customerName, customerPhone, companyName, deliveryAddress, lang],
  );

  // ── Submit ────────────────────────────────────────────────────────────
  const canSubmit = title.trim() && assigneeIds.length > 0 && cards.length > 0;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // Pull each card's attached files out so we can upload them after the
      // task is created. We strip them from the cards payload before saving
      // because File objects can't be serialised into the description blob.
      const attachmentsByCardId: Record<string, File[]> = {};
      const cardsForSave: CustomOrderCard[] = cards.map((c) => {
        attachmentsByCardId[c.id] = c.attachments ?? [];
        return { ...c, attachments: [] };
      });
      const desc = buildOrderDescription({
        brief,
        cards: cardsForSave,
        customer: { name: customerName, phone: customerPhone, company: companyName },
        deliveryAddress,
        labels,
        productTypeLabel: (pt) => t(productTypeKey(pt)),
        systemLabel: (s) => t(systemKey(s)),
        fillingLabel: (f) => t(fillingKey(f)),
        frameTypeLabel: (ft) => t(frameTypeKey(ft)),
        frameColorLabel: (fc) => t(frameColorKey(fc)),
        sheetTypeLabel: (s) => t(sheetTypeKey(s)),
        sheetColorLabel: (s) => t(sheetColorKey(s)),
        glassTypeLabel: (g) => t(glassTypeKey(g)),
        glassThicknessLabel: (g) => t(glassThicknessKey(g)),
        glassTintLabel: (g) => t(glassTintKey(g)),
        glassShadeLabel: (g) => t(glassShadeKey(g)),
        lockTypeLabel: (g) => t(lockTypeKey(g)),
        handleTypeLabel: (g) => t(handleTypeKey(g)),
        hingeTypeLabel: (g) => t(hingeTypeKey(g)),
        openDirectionLabel: (g) => t(openDirectionKey(g)),
        accessoryLabel: (k) => t(accessoryKey(k)),
      });

      const parsedTotal = totalAmountStr.trim() ? Number(totalAmountStr) : null;
      const parsedPaid = amountPaidStr.trim() ? Number(amountPaidStr) : null;

      const saved = await onSave({
        assignee_ids: assigneeIds,
        title: finalTitle,
        description: desc || null,
        due_date: dueDate.trim() || null,
        order_reference: orderReference.trim() || null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        client_id: clientId,
        total_amount: parsedTotal !== null && Number.isFinite(parsedTotal) ? parsedTotal : null,
        amount_paid: parsedPaid !== null && Number.isFinite(parsedPaid) ? parsedPaid : null,
      });
      if (saved) {
        // Upload all per-card attachments — partial failures only warn, the task
        // is already saved so we don't roll back.
        let anyFailed = false;
        for (const cardId of Object.keys(attachmentsByCardId)) {
          for (const file of attachmentsByCardId[cardId]) {
            try {
              await tasksApi.uploadAttachment(saved.id, file, token);
            } catch {
              anyFailed = true;
            }
          }
        }
        if (anyFailed) setError(t('customOrderAttachmentsPartialFail'));
        setSavedTask(saved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div className="no-print absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      {/* no-print: when the nested invoice modal triggers printing, the global
          print rule hides this live form so only the invoice prints. */}
      <div className="no-print relative flex max-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-800 sm:max-h-[95vh] sm:max-w-5xl sm:rounded-2xl">
        {/* Header */}
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
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 p-1.5 text-white/90 transition hover:bg-white/20" aria-label={t('close')}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 pb-32">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Customer & order info */}
          <Section title={t('customOrderSectionCustomer')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('taskRegisteredClientLabel')} full>
                <select value={clientId ?? ''} onChange={(e) => setClientId(e.target.value || null)} className={inputCls}>
                  <option value="">{t('selectRegisteredClientOptional')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('taskCustomerNameLabel')}>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} placeholder={t('taskCustomerNamePlaceholder')} />
              </Field>
              <Field label={t('taskCustomerPhoneLabel')}>
                <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputCls} placeholder={t('taskCustomerPhonePlaceholder')} dir="ltr" />
              </Field>
              <Field label={t('customOrderTitleLabel')} full>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={t('customOrderTitlePlaceholder')} required />
                {title.trim() && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {t('customOrderTitlePreview')}: <span className="font-mono">{finalTitle}</span>
                  </p>
                )}
              </Field>
              <Field label={t('customOrderBriefLabel')} full>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder={t('customOrderBriefPlaceholder')} />
              </Field>
              <Field label={t('dueDate')}>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t('orderReference')}>
                <input type="text" value={orderReference} onChange={(e) => setOrderReference(e.target.value)} className={inputCls} placeholder={t('orderReference')} />
              </Field>
              <Field label={t('customOrderDeliveryAddressLabel')} full>
                <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inputCls} placeholder={t('customOrderDeliveryAddressPlaceholder')} />
              </Field>
            </div>
          </Section>

          {/* Product cards */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('customOrderCardsSection')}</h3>
                {cards.length > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                    {cards.length} {t('customOrderCardsCountBadge')}
                  </span>
                )}
              </div>
              {cards.length > 0 && (
                <button type="button" onClick={openBuilderForNew} className="rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                  + {t('customOrderCardsAddAnother')}
                </button>
              )}
            </div>

            {cards.length === 0 ? (
              <EmptyCardsBlock onCreate={openBuilderForNew} title={t('customOrderCardsEmptyTitle')} desc={t('customOrderCardsEmptyDesc')} cta={t('customOrderCardsCreateFirst')} />
            ) : (
              <div className="space-y-3">
                {cards.map((card, idx) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    index={idx + 1}
                    expanded={expandedCardIds.has(card.id)}
                    onToggle={() => toggleCardExpanded(card.id)}
                    onEdit={() => openBuilderForEdit(card)}
                    onDuplicate={() => duplicateCard(card)}
                    onDelete={() => deleteCard(card.id)}
                    productTypeLabel={(pt) => t(productTypeKey(pt))}
                    fillingLabel={(f) => t(fillingKey(f))}
                    frameColorLabel={(c) => t(frameColorKey(c))}
                    sheetTypeLabel={(s) => t(sheetTypeKey(s))}
                    sheetColorLabel={(s) => t(sheetColorKey(s))}
                    glassTypeLabel={(g) => t(glassTypeKey(g))}
                    glassThicknessLabel={(g) => t(glassThicknessKey(g))}
                    glassTintLabel={(g) => t(glassTintKey(g))}
                    glassShadeLabel={(g) => t(glassShadeKey(g))}
                    t={t}
                  />
                ))}
                <button type="button" onClick={openBuilderForNew} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-violet-400 hover:bg-violet-50/40 hover:text-violet-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:bg-violet-950/20">
                  + {t('customOrderCardsAddAnother')}
                </button>
              </div>
            )}
          </section>

          {/* Team assignment — only shown once at least one card exists */}
          {cards.length > 0 && (
            <Section title={t('customOrderSectionAssignees')}>
              <TeamAssignment
                available={availableEmployees}
                selected={selectedEmployees}
                onAdd={(id) => setAssigneeIds((prev) => prev.includes(id) ? prev : [...prev, id])}
                onRemove={(id) => setAssigneeIds((prev) => prev.filter((x) => x !== id))}
                emptyLabel={t('customOrderAllAssigned')}
              />
            </Section>
          )}

          {/* Payment — appears after cards are added; price is set once all items are listed. */}
          {cards.length > 0 && (
            <Section title={t('customOrderSectionPayment')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={t('customOrderPaymentTotal')}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={totalAmountStr}
                    onChange={(e) => setTotalAmountStr(e.target.value)}
                    className={inputCls}
                    placeholder={totalPrice > 0 ? totalPrice.toFixed(2) : '0.00'}
                    dir="ltr"
                  />
                </Field>
                <Field label={t('customOrderPaymentPaid')}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amountPaidStr}
                    onChange={(e) => setAmountPaidStr(e.target.value)}
                    className={inputCls}
                    placeholder="0.00"
                    dir="ltr"
                  />
                </Field>
                <Field label={t('customOrderPaymentRemaining')}>
                  {(() => {
                    const total = totalAmountStr.trim() ? Number(totalAmountStr) : null;
                    const paid = amountPaidStr.trim() ? Number(amountPaidStr) : 0;
                    const remaining = total !== null && Number.isFinite(total) && Number.isFinite(paid)
                      ? Math.max(0, total - paid)
                      : null;
                    const over = total !== null && Number.isFinite(total) && Number.isFinite(paid) && paid > total + 0.009;
                    return (
                      <input
                        readOnly
                        value={remaining !== null ? remaining.toFixed(2) : ''}
                        placeholder="0.00"
                        className={`${inputCls} cursor-default ${over ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}
                        dir="ltr"
                      />
                    );
                  })()}
                </Field>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {t('customOrderPaymentHint')}
              </p>
            </Section>
          )}

          {/* Optional saved-description preview */}
          {description && cards.length > 0 && (
            <details className="text-xs text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer font-medium">{t('customOrderPreviewDescription')}</summary>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">{description}</pre>
            </details>
          )}
        </form>

        {/* Sticky footer bar — only when there is at least one card */}
        {cards.length > 0 && (
          <StickyFooter
            customerName={customerName}
            cardCount={cards.length}
            totalQty={totalQty}
            totalPrice={totalPrice}
            t={t}
            savedTask={savedTask}
            onSubmit={handleSubmit}
            canSubmit={!!canSubmit}
            saving={saving}
            onOpenInvoice={(mode) => setInvoiceMode(mode)}
          />
        )}

        {/* Cancel-only footer when no cards yet */}
        {cards.length === 0 && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-800">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">{t('cancel')}</button>
          </div>
        )}
      </div>

      {/* Product-card builder side-panel */}
      {builderOpenForId && builderDraft && (
        <CardBuilderPanel
          draft={builderDraft}
          onChange={setBuilderDraft}
          onCancel={closeBuilder}
          onSubmit={() => builderDraft && commitBuilder(builderDraft)}
          isEditing={builderOpenForId !== '__new__'}
        />
      )}

      {/* Invoice modal */}
      {invoiceMode && savedTask && (
        <CustomOrderInvoiceModal
          mode={invoiceMode}
          orderTitle={finalTitle}
          orderBrief={brief}
          orderReference={orderReference}
          dueDate={dueDate}
          deliveryAddress={deliveryAddress}
          customer={{ name: customerName, phone: customerPhone, company: companyName }}
          cards={cards}
          assignees={selectedEmployees}
          totalQty={totalQty}
          totalPrice={totalPrice}
          onSwitch={(m) => setInvoiceMode(m)}
          onClose={() => setInvoiceMode(null)}
        />
      )}
    </div>
  );
};

// ── i18n key resolvers ────────────────────────────────────────────────────
// Each resolver returns a translations key. We narrow to `TKey` via the central
// `keyOf` helper so the call site stays type-safe but each lookup table can be a
// flat Record<string, TKey> instead of fighting `as const` with index errors.

const keyOf = <T extends Record<string, TKey>>(table: T, k: string, fallback: TKey): TKey =>
  (table as Record<string, TKey>)[k] ?? fallback;

const PRODUCT_TYPE_KEYS: Record<ProductType, TKey> = {
  window: 'customOrderPkgProductTypeWindow',
  aluminum_door: 'customOrderPkgProductTypeAluminumDoor',
  glass_door: 'customOrderPkgProductTypeGlassDoor',
  glass_facade: 'customOrderPkgProductTypeGlassFacade',
  canopy: 'customOrderPkgProductTypeCanopy',
  glass_partition: 'customOrderPkgProductTypeGlassPartition',
  mesh_door: 'customOrderPkgProductTypeMeshDoor',
  cabinet: 'customOrderPkgProductTypeCabinet',
  aluminum_kitchen: 'customOrderPkgProductTypeAluminumKitchen',
};
const productTypeKey = (pt: ProductType): TKey => PRODUCT_TYPE_KEYS[pt];

const SYSTEM_KEYS: Record<string, TKey> = {
  sliding: 'customOrderPkgSystemSliding',
  hinged: 'customOrderPkgSystemHinged',
  fixed: 'customOrderPkgSystemFixed',
  folding: 'customOrderPkgSystemFolding',
  tilt_turn: 'customOrderPkgSystemTiltTurn',
  sliding_door: 'customOrderPkgSystemSlidingDoor',
  hinged_door: 'customOrderPkgSystemHingedDoor',
  pivot: 'customOrderPkgSystemPivot',
  folding_door: 'customOrderPkgSystemFoldingDoor',
  '45_90': 'customOrderPkgSystem4590',
  european: 'customOrderPkgSystemEuropean',
  japanese: 'customOrderPkgSystemJapanese',
};
const systemKey = (s: string): TKey => keyOf(SYSTEM_KEYS, s, 'customOrderPkgProductSystem');

const FILLING_KEYS: Record<string, TKey> = {
  '': 'customOrderBuilderFilling',
  aluminum_only: 'customOrderBuilderFillingAluminumOnly',
  glass_only: 'customOrderBuilderFillingGlassOnly',
  glass_and_aluminum: 'customOrderBuilderFillingGlassAndAluminum',
};
const fillingKey = (f: FillingOption): TKey => keyOf(FILLING_KEYS, f, 'customOrderBuilderFilling');

const FRAME_TYPE_KEYS: Record<string, TKey> = {
  single: 'customOrderPkgFrameTypeSingle',
  double: 'customOrderPkgFrameTypeDouble',
  hidden_sash: 'customOrderPkgFrameTypeHiddenSash',
  frameless: 'customOrderPkgFrameTypeFrameless',
};
const frameTypeKey = (ft: string): TKey => keyOf(FRAME_TYPE_KEYS, ft, 'customOrderPkgFrameTypeSection');

const FRAME_COLOR_KEYS: Record<string, TKey> = {
  natural_silver: 'customOrderPkgFrameColorNaturalSilver',
  white: 'customOrderPkgFrameColorWhite',
  matte_black: 'customOrderPkgFrameColorMatteBlack',
  gold: 'customOrderPkgFrameColorGold',
  bronze: 'customOrderPkgFrameColorBronze',
  dark_grey: 'customOrderPkgFrameColorDarkGrey',
  wood_brown: 'customOrderPkgFrameColorWoodBrown',
  pearl_white: 'customOrderPkgFrameColorPearlWhite',
  titanium: 'customOrderPkgFrameColorTitanium',
};
const frameColorKey = (fc: string): TKey => keyOf(FRAME_COLOR_KEYS, fc, 'customOrderPkgFrameColor');

const SHEET_TYPE_KEYS: Record<string, TKey> = {
  aluminum_sheet: 'customOrderPkgSheetTypeAluminumSheet',
  aluminum_panel: 'customOrderPkgSheetTypeAluminumPanel',
  compressed: 'customOrderPkgSheetTypeCompressed',
  wood_panel: 'customOrderPkgSheetTypeWoodPanel',
  insulated: 'customOrderPkgSheetTypeInsulated',
};
const sheetTypeKey = (s: string): TKey => keyOf(SHEET_TYPE_KEYS, s, 'customOrderPkgSheetType');

const SHEET_COLOR_KEYS: Record<string, TKey> = {
  silver: 'customOrderPkgSheetColorSilver',
  white: 'customOrderPkgSheetColorWhite',
  black: 'customOrderPkgSheetColorBlack',
  bronze: 'customOrderPkgSheetColorBronze',
  gold: 'customOrderPkgSheetColorGold',
  grey: 'customOrderPkgSheetColorGrey',
  wood: 'customOrderPkgSheetColorWood',
  beige: 'customOrderPkgSheetColorBeige',
};
const sheetColorKey = (s: string): TKey => keyOf(SHEET_COLOR_KEYS, s, 'customOrderPkgSheetColor');

const GLASS_TYPE_KEYS: Record<string, TKey> = {
  normal: 'customOrderPkgGlassTypeNormal',
  double_dgu: 'customOrderPkgGlassTypeDoubleDGU',
  triple_tgu: 'customOrderPkgGlassTypeTripleTGU',
  tempered: 'customOrderPkgGlassTypeTempered',
  laminated: 'customOrderPkgGlassTypeLaminated',
  low_e: 'customOrderPkgGlassTypeLowE',
  smart: 'customOrderPkgGlassTypeSmart',
};
const glassTypeKey = (g: string): TKey => keyOf(GLASS_TYPE_KEYS, g, 'customOrderPkgGlassType');

const GLASS_THICKNESS_KEYS: Record<string, TKey> = {
  '4mm': 'customOrderPkgGlassThickness4mm',
  '5mm': 'customOrderPkgGlassThickness5mm',
  '6mm': 'customOrderPkgGlassThickness6mm',
  '8mm': 'customOrderPkgGlassThickness8mm',
  '10mm': 'customOrderPkgGlassThickness10mm',
  '12mm': 'customOrderPkgGlassThickness12mm',
  '6plus6': 'customOrderPkgGlassThickness6plus6',
  '8plus8': 'customOrderPkgGlassThickness8plus8',
};
const glassThicknessKey = (g: string): TKey => keyOf(GLASS_THICKNESS_KEYS, g, 'customOrderPkgGlassThickness');

const GLASS_TINT_KEYS: Record<string, TKey> = {
  clear: 'customOrderPkgGlassTintClear',
  whitened: 'customOrderPkgGlassTintWhitened',
  bronze: 'customOrderPkgGlassTintBronze',
  grey: 'customOrderPkgGlassTintGrey',
  green: 'customOrderPkgGlassTintGreen',
  blue: 'customOrderPkgGlassTintBlue',
  black: 'customOrderPkgGlassTintBlack',
};
const glassTintKey = (g: string): TKey => keyOf(GLASS_TINT_KEYS, g, 'customOrderPkgGlassTint');

const GLASS_SHADE_KEYS: Record<string, TKey> = {
  none: 'customOrderPkgGlassShadeNone',
  '20': 'customOrderPkgGlassShade20',
  '30': 'customOrderPkgGlassShade30',
  '40': 'customOrderPkgGlassShade40',
  '50': 'customOrderPkgGlassShade50',
};
const glassShadeKey = (g: string): TKey => keyOf(GLASS_SHADE_KEYS, g, 'customOrderPkgGlassShade');

const LOCK_TYPE_KEYS: Record<string, TKey> = {
  standard: 'customOrderPkgLockTypeStandard',
  with_key: 'customOrderPkgLockTypeWithKey',
  magnetic: 'customOrderPkgLockTypeMagnetic',
  digital: 'customOrderPkgLockTypeDigital',
};
const lockTypeKey = (g: string): TKey => keyOf(LOCK_TYPE_KEYS, g, 'customOrderPkgLockType');

const HANDLE_TYPE_KEYS: Record<string, TKey> = {
  standard: 'customOrderPkgHandleTypeStandard',
  european: 'customOrderPkgHandleTypeEuropean',
  japanese: 'customOrderPkgHandleTypeJapanese',
  italian: 'customOrderPkgHandleTypeItalian',
};
const handleTypeKey = (g: string): TKey => keyOf(HANDLE_TYPE_KEYS, g, 'customOrderPkgHandleType');

const HINGE_TYPE_KEYS: Record<string, TKey> = {
  standard: 'customOrderPkgHingeTypeStandard',
  hidden: 'customOrderPkgHingeTypeHidden',
  arm: 'customOrderPkgHingeTypeArm',
  soft_close: 'customOrderPkgHingeTypeSoftClose',
};
const hingeTypeKey = (g: string): TKey => keyOf(HINGE_TYPE_KEYS, g, 'customOrderPkgHingeType');

const OPEN_DIRECTION_KEYS: Record<string, TKey> = {
  right: 'customOrderPkgOpenDirectionRight',
  left: 'customOrderPkgOpenDirectionLeft',
  inward: 'customOrderPkgOpenDirectionInward',
  outward: 'customOrderPkgOpenDirectionOutward',
  sliding: 'customOrderPkgOpenDirectionSliding',
};
const openDirectionKey = (g: string): TKey => keyOf(OPEN_DIRECTION_KEYS, g, 'customOrderPkgOpenDirection');

const ACCESSORY_KEYS_TKEY: Record<string, TKey> = {
  slidingWheels: 'customOrderPkgAccSlidingWheels',
  thermalInsulation: 'customOrderPkgAccThermalInsulation',
  acousticInsulation: 'customOrderPkgAccAcousticInsulation',
  insectMesh: 'customOrderPkgAccInsectMesh',
  softClose: 'customOrderPkgAccSoftClose',
  siliconeTouch: 'customOrderPkgAccSiliconeTouch',
  waterSeal: 'customOrderPkgAccWaterSeal',
  dustSeal: 'customOrderPkgAccDustSeal',
  ledLighting: 'customOrderPkgAccLedLighting',
  smartLock: 'customOrderPkgAccSmartLock',
  fingerprintLock: 'customOrderPkgAccFingerprintLock',
  cabinetSystem: 'customOrderPkgAccCabinetSystem',
  kitchenAccessories: 'customOrderPkgAccKitchenAccessories',
};
const accessoryKey = (k: string): TKey => keyOf(ACCESSORY_KEYS_TKEY, k, 'customOrderPkgHardwareSection');

// ── Sub-components ────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode; full?: boolean }> = ({ label, children, full }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
    {children}
  </div>
);

const EmptyCardsBlock: React.FC<{ onCreate: () => void; title: string; desc: string; cta: string }> = ({ onCreate, title, desc, cta }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-600 dark:bg-slate-800/40">
    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-rose-500 text-white">
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    </div>
    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
    <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    <button type="button" onClick={onCreate} className="rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/30 transition hover:from-violet-500 hover:to-fuchsia-400">
      {cta}
    </button>
  </div>
);

const CardRow: React.FC<{
  card: CustomOrderCard;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  productTypeLabel: (pt: ProductType) => string;
  fillingLabel: (f: FillingOption) => string;
  frameColorLabel: (fc: string) => string;
  sheetTypeLabel: (s: string) => string;
  sheetColorLabel: (s: string) => string;
  glassTypeLabel: (g: string) => string;
  glassThicknessLabel: (g: string) => string;
  glassTintLabel: (g: string) => string;
  glassShadeLabel: (g: string) => string;
  t: (k: TKey) => string;
}> = ({ card, index, expanded, onToggle, onEdit, onDuplicate, onDelete, productTypeLabel, fillingLabel, frameColorLabel, sheetTypeLabel, sheetColorLabel, glassTypeLabel, glassThicknessLabel, glassTintLabel, glassShadeLabel, t }) => {
  const ready = !!card.spec.productType;
  const accessoriesOn = ACCESSORY_KEYS.filter((k) => (card.spec.accessories as any)[k]).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-rose-500 font-bold text-white">
          {index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {card.spec.productType ? productTypeLabel(card.spec.productType) : t('customOrderCardUntitled')}
            </h4>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {ready ? t('customOrderCardStatusReady') : t('customOrderCardStatusDraft')}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            {card.spec.width && card.spec.height && (
              <span>{card.spec.width} × {card.spec.height} {card.spec.unit}</span>
            )}
            <span>×{card.spec.quantity || '1'}</span>
            {card.spec.frameColor && <span>{frameColorLabel(card.spec.frameColor)}</span>}
            {accessoriesOn > 0 && <span>{accessoriesOn} {t('customOrderPkgAccessoriesEnabledCount')}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onToggle} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" title={expanded ? t('customOrderCardCollapse') : t('customOrderCardOpen')}>
            <svg className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          </button>
          <button type="button" onClick={onEdit} className="rounded-lg bg-violet-50 p-1.5 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300" title={t('customOrderCardEdit')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.8a2.121 2.121 0 1 1 3 3L19.862 7.487M16.862 4.487 9 12.349V15h2.652l7.21-7.213M16.862 4.487l3 3" /></svg>
          </button>
          <button type="button" onClick={onDuplicate} className="rounded-lg bg-sky-50 p-1.5 text-sky-600 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300" title={t('customOrderCardDuplicate')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
          </button>
          <button type="button" onClick={onDelete} className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300" title={t('customOrderCardDelete')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
          </button>
        </div>
      </div>

      {/* Price strip */}
      {card.estimatedPrice && parseFloat(card.estimatedPrice) > 0 && (
        <div className="flex items-center justify-between border-t border-violet-100 bg-violet-50/40 px-4 py-2 text-xs dark:border-violet-900 dark:bg-violet-950/20">
          <span className="text-slate-500 dark:text-slate-400">{t('customOrderCardEstimatedPrice')}</span>
          <span className="bg-linear-to-r from-violet-600 to-fuchsia-500 bg-clip-text font-bold text-transparent">
            {parseFloat(card.estimatedPrice).toLocaleString()} ILS
          </span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 bg-slate-50/50 p-4 text-xs dark:border-slate-700 dark:bg-slate-900/30 sm:grid-cols-3">
          <DetailGroup title={t('customOrderInvoiceBasicData')}>
            {card.spec.productType && <DetailLine label={t('customOrderPkgProductType')} value={productTypeLabel(card.spec.productType)} />}
            {card.spec.system && <DetailLine label={t('customOrderPkgProductSystem')} value={card.spec.system} />}
            {card.spec.filling && card.spec.productType !== 'window' && <DetailLine label={t('customOrderBuilderFilling')} value={fillingLabel(card.spec.filling)} />}
            {card.spec.frameColor && <DetailLine label={t('customOrderPkgFrameColor')} value={frameColorLabel(card.spec.frameColor)} />}
          </DetailGroup>
          {(card.spec.sheetType || card.spec.sheetColor) && (
            <DetailGroup title={t('customOrderInvoiceSheetData')} tone="amber">
              {card.spec.sheetType && <DetailLine label={t('customOrderPkgSheetType')} value={sheetTypeLabel(card.spec.sheetType)} />}
              {card.spec.sheetColor && <DetailLine label={t('customOrderPkgSheetColor')} value={sheetColorLabel(card.spec.sheetColor)} />}
            </DetailGroup>
          )}
          {(card.spec.glassType || card.spec.glassThickness || card.spec.glassTint || card.spec.glassShade) && (
            <DetailGroup title={t('customOrderInvoiceGlassData')} tone="blue">
              {card.spec.glassType && <DetailLine label={t('customOrderPkgGlassType')} value={glassTypeLabel(card.spec.glassType)} />}
              {card.spec.glassThickness && <DetailLine label={t('customOrderPkgGlassThickness')} value={glassThicknessLabel(card.spec.glassThickness)} />}
              {card.spec.glassTint && <DetailLine label={t('customOrderPkgGlassTint')} value={glassTintLabel(card.spec.glassTint)} />}
              {card.spec.glassShade && <DetailLine label={t('customOrderPkgGlassShade')} value={glassShadeLabel(card.spec.glassShade)} />}
            </DetailGroup>
          )}
          {card.spec.productionNotes && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 sm:col-span-3 dark:border-violet-900 dark:bg-violet-950/30">
              <p className="mb-1 text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">{t('customOrderPkgNotesSection')}</p>
              <p className="text-xs text-slate-700 dark:text-slate-200">{card.spec.productionNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DetailGroup: React.FC<{ title: string; tone?: 'amber' | 'blue'; children: React.ReactNode }> = ({ title, tone, children }) => {
  const bg = tone === 'amber' ? 'bg-amber-50 dark:bg-amber-950/20' : tone === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-800';
  return (
    <div className={`rounded-lg border border-slate-200 p-3 dark:border-slate-700 ${bg}`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
};
const DetailLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-2">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-medium text-slate-700 dark:text-slate-200">{value}</span>
  </div>
);

// ── Team assignment ───────────────────────────────────────────────────────

const TeamAssignment: React.FC<{
  available: User[];
  selected: User[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  emptyLabel: string;
}> = ({ available, selected, onAdd, onRemove, emptyLabel }) => (
  <div className="grid grid-cols-2 gap-3">
    {[...selected, ...available].map((u) => {
      const isSelected = selected.some((s) => s.id === u.id);
      return (
        <button
          key={u.id}
          type="button"
          onClick={() => (isSelected ? onRemove(u.id) : onAdd(u.id))}
          className={`flex items-center gap-3 rounded-xl border-2 p-3 text-start transition ${
            isSelected
              ? 'border-violet-400 bg-violet-50/60 dark:border-violet-500 dark:bg-violet-950/30'
              : 'border-slate-200 bg-white hover:border-violet-200 dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(u.id)}`}>
            {initials(u.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{u.name}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{u.role || u.email}</p>
          </div>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${isSelected ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
            {isSelected && (
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.005L3.29 9.83a1 1 0 1 1 1.42-1.408l3.793 3.83 6.79-6.881a1 1 0 0 1 1.41-.082Z" clipRule="evenodd" /></svg>
            )}
          </span>
        </button>
      );
    })}
    {available.length === 0 && selected.length === 0 && (
      <p className="col-span-2 text-center text-xs text-slate-400 dark:text-slate-500">{emptyLabel}</p>
    )}
  </div>
);

// ── Sticky footer ─────────────────────────────────────────────────────────

const StickyFooter: React.FC<{
  customerName: string;
  cardCount: number;
  totalQty: number;
  totalPrice: number;
  t: (k: any) => string;
  savedTask: ApiTask | null;
  onSubmit: () => void;
  canSubmit: boolean;
  saving: boolean;
  onOpenInvoice: (mode: 'employee' | 'customer') => void;
}> = ({ customerName, cardCount, totalQty, totalPrice, t, savedTask, onSubmit, canSubmit, saving, onOpenInvoice }) => (
  <div className="absolute inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-slate-400">{t('customOrderFooterCustomer')}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{customerName || '—'}</span>
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-slate-400">{t('customOrderFooterCards')}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{cardCount}</span>
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-slate-400">{t('customOrderFooterTotalQty')}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{totalQty}</span>
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-slate-400">{t('customOrderFooterTotalPrice')}</span>
          <span className="bg-linear-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-base font-bold text-transparent">
            {totalPrice.toLocaleString()} ILS
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {savedTask ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.005L3.29 9.83a1 1 0 1 1 1.42-1.408l3.793 3.83 6.79-6.881a1 1 0 0 1 1.41-.082Z" clipRule="evenodd" /></svg>
              {t('customOrderFooterCreateSuccess')}
            </span>
            <button type="button" onClick={() => onOpenInvoice('employee')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500">
              {t('customOrderFooterViewEmployeeInvoice')}
            </button>
            <button type="button" onClick={() => onOpenInvoice('customer')} className="rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
              {t('customOrderFooterViewCustomerInvoice')}
            </button>
          </>
        ) : (
          <button type="button" onClick={onSubmit} disabled={!canSubmit || saving} className="rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/30 transition hover:from-violet-500 hover:to-fuchsia-400 disabled:opacity-50">
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {t('customOrderFooterCreateBtn')}
              </span>
            ) : t('customOrderFooterCreateBtn')}
          </button>
        )}
      </div>
    </div>
  </div>
);

// ── Card builder side-panel ───────────────────────────────────────────────

const CardBuilderPanel: React.FC<{
  draft: CustomOrderCard;
  onChange: (next: CustomOrderCard) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isEditing: boolean;
}> = ({ draft, onChange, onCancel, onSubmit, isEditing }) => {
  const { t } = useApp();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    product: true, filling: true, sheet: false, frame: true, glass: true,
    accessories: false, notes: false, attachments: false,
  });
  const toggleSection = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  const isWindow = draft.spec.productType === 'window';
  const isDoor = draft.spec.productType !== '' && DOOR_LIKE.includes(draft.spec.productType);

  const systems = isWindow ? WINDOW_SYSTEMS : isDoor ? DOOR_SYSTEMS : GENERIC_SYSTEMS;

  // For windows, force filling to glass_only — sheet section is hidden.
  const effectiveFilling: FillingOption = isWindow ? 'glass_only' : draft.spec.filling;
  const showSheet = !isWindow && (effectiveFilling === 'aluminum_only' || effectiveFilling === 'glass_and_aluminum');
  const showGlass = isWindow || effectiveFilling === '' || effectiveFilling === 'glass_only' || effectiveFilling === 'glass_and_aluminum';
  const glassDisabledByAluminumOnly = !isWindow && effectiveFilling === 'aluminum_only';

  const patch = (p: Partial<CustomOrderCard['spec']>) => onChange({ ...draft, spec: { ...draft.spec, ...p } });
  const patchAccessories = (k: string, v: boolean) => onChange({ ...draft, spec: { ...draft.spec, accessories: { ...draft.spec.accessories, [k]: v } } });

  const handleProductTypeChange = (pt: ProductType) => {
    // Per spec: switching the product type resets system + applies windows-glass-only rule.
    const next: Partial<CustomOrderCard['spec']> = { productType: pt, system: '' };
    if (pt === 'window') {
      next.filling = 'glass_only';
      next.sheetType = '';
      next.sheetColor = '';
    }
    patch(next);
  };

  const handleFillingChange = (f: FillingOption) => {
    if (isWindow) return; // Windows are locked
    const next: Partial<CustomOrderCard['spec']> = { filling: f };
    if (f === 'aluminum_only') {
      next.glassType = '';
      next.glassThickness = '';
      next.glassTint = '';
      next.glassShade = '';
    } else if (f === 'glass_only') {
      next.sheetType = '';
      next.sheetColor = '';
    }
    patch(next);
  };

  const accessoriesOn = ACCESSORY_KEYS.filter((k) => (draft.spec.accessories as any)[k]).length;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

  return (
    <div className="no-print fixed inset-0 z-60 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div className="relative ms-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 bg-linear-to-r from-violet-600 to-fuchsia-500 px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-2 ring-white/30">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">{isEditing ? t('customOrderBuilderEditTitle') : t('customOrderBuilderNewTitle')}</h2>
              <p className="text-xs text-white/80">{t('customOrderCardsHint')}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg bg-white/10 p-1.5 text-white/90 hover:bg-white/20" aria-label={t('close')}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* 1. Product details */}
          <Accordion title={t('customOrderBuilderProductInfo')} open={openSections.product} onToggle={() => toggleSection('product')}>
            <div className="space-y-3">
              <Field label={t('customOrderPkgProductType')} full>
                <select value={draft.spec.productType} onChange={(e) => handleProductTypeChange(e.target.value as ProductType)} className={inputCls}>
                  <option value="">—</option>
                  {PRODUCT_TYPES.map((pt) => (
                    <option key={pt} value={pt}>{t(productTypeKey(pt) as any)}</option>
                  ))}
                </select>
              </Field>
              {draft.spec.productType && (
                <Field label={t('customOrderPkgProductSystem')} full>
                  <select value={draft.spec.system} onChange={(e) => patch({ system: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {systems.map((s) => (
                      <option key={s} value={s}>{t(systemKey(s) as any)}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Field label={t('customOrderPkgWidth')}>
                  <input type="number" min={0} dir="ltr" value={draft.spec.width} onChange={(e) => patch({ width: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t('customOrderPkgHeight')}>
                  <input type="number" min={0} dir="ltr" value={draft.spec.height} onChange={(e) => patch({ height: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t('customOrderPkgQuantity')}>
                  <input type="number" min={1} dir="ltr" value={draft.spec.quantity} onChange={(e) => patch({ quantity: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label={t('customOrderPkgUnit')} full>
                <div className="flex gap-2">
                  {(['cm', 'meter'] as const).map((u) => (
                    <button key={u} type="button" onClick={() => patch({ unit: u as any })} className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${draft.spec.unit === u ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/30 dark:text-violet-200' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800'}`}>
                      {u === 'cm' ? t('customOrderPkgUnitCm') : t('customOrderPkgUnitMeter')}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Accordion>

          {/* 2. Filling option — hidden entirely for windows */}
          {!isWindow && (
            <Accordion title={t('customOrderBuilderFilling')} open={openSections.filling} onToggle={() => toggleSection('filling')}>
              <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">{t('customOrderBuilderFillingNote')}</p>
              <div className="grid grid-cols-3 gap-2">
                {(['aluminum_only', 'glass_only', 'glass_and_aluminum'] as FillingOption[]).map((f) => (
                  <button key={f} type="button" onClick={() => handleFillingChange(f)} className={`rounded-full border-2 px-3 py-2 text-xs font-semibold transition ${draft.spec.filling === f ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/30 dark:text-violet-200' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800'}`}>
                    {t(fillingKey(f) as any)}
                  </button>
                ))}
              </div>
            </Accordion>
          )}

          {/* 3. Sheet — only when aluminum is part of the filling */}
          {showSheet && (
            <Accordion title={t('customOrderBuilderSheet')} open={openSections.sheet} onToggle={() => toggleSection('sheet')} tone="amber">
              <div className="space-y-3 rounded-xl bg-amber-50/60 p-3 dark:bg-amber-950/20">
                <Field label={t('customOrderPkgSheetType')} full>
                  <select value={draft.spec.sheetType} onChange={(e) => patch({ sheetType: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {SHEET_TYPES.map((s) => (
                      <option key={s} value={s}>{t(sheetTypeKey(s) as any)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('customOrderPkgSheetColor')} full>
                  <div className="grid grid-cols-2 gap-2">
                    {SHEET_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => patch({ sheetColor: c })} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${draft.spec.sheetColor === c ? 'border-amber-500 bg-amber-100 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-800'}`}>
                        {t(sheetColorKey(c) as any)}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Accordion>
          )}

          {/* 4. Frame */}
          <Accordion title={t('customOrderPkgFrameTypeSection')} open={openSections.frame} onToggle={() => toggleSection('frame')}>
            <div className="space-y-3">
              <Field label={t('customOrderPkgFrameTypeSection')} full>
                <div className="grid grid-cols-2 gap-2">
                  {FRAME_TYPES.map((ft) => (
                    <button key={ft} type="button" onClick={() => patch({ frameType: ft })} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${draft.spec.frameType === ft ? 'border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-100' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800'}`}>
                      {t(frameTypeKey(ft) as any)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('customOrderPkgFrameColor')} full>
                <div className="grid grid-cols-3 gap-2">
                  {FRAME_COLORS.map((fc) => (
                    <button key={fc} type="button" onClick={() => patch({ frameColor: fc })} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${draft.spec.frameColor === fc ? 'border-violet-500 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-100' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800'}`}>
                      {t(frameColorKey(fc) as any)}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Accordion>

          {/* 5. Glass */}
          {showGlass && (
            <Accordion title={t('customOrderPkgGlassSection')} open={openSections.glass} onToggle={() => toggleSection('glass')} tone="blue">
              {isWindow && (
                <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  {t('customOrderBuilderWindowFixedNotice')}
                </div>
              )}
              {glassDisabledByAluminumOnly ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-300">
                  {t('customOrderBuilderAluminumOnlyGlassDisabled')}
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label={t('customOrderPkgGlassType')} full>
                    <select value={draft.spec.glassType} onChange={(e) => patch({ glassType: e.target.value })} className={inputCls}>
                      <option value="">—</option>
                      {GLASS_TYPES.map((g) => (
                        <option key={g} value={g}>{t(glassTypeKey(g) as any)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('customOrderPkgGlassThickness')} full>
                    <select value={draft.spec.glassThickness} onChange={(e) => patch({ glassThickness: e.target.value })} className={inputCls}>
                      <option value="">—</option>
                      {GLASS_THICKNESSES.map((g) => (
                        <option key={g} value={g}>{t(glassThicknessKey(g) as any)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('customOrderPkgGlassTint')} full>
                    <div className="grid grid-cols-3 gap-2">
                      {GLASS_TINTS.map((g) => (
                        <button key={g} type="button" onClick={() => patch({ glassTint: g })} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${draft.spec.glassTint === g ? 'border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800'}`}>
                          {t(glassTintKey(g) as any)}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t('customOrderPkgGlassShade')} full>
                    <div className="flex flex-wrap gap-2">
                      {GLASS_SHADES.map((g) => (
                        <button key={g} type="button" onClick={() => patch({ glassShade: g })} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${draft.spec.glassShade === g ? 'border-blue-500 bg-blue-100 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800'}`}>
                          {t(glassShadeKey(g) as any)}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}
            </Accordion>
          )}

          {/* 6. Accessories & extras */}
          <Accordion title={`${t('customOrderBuilderAccessoriesExtras')}${accessoriesOn ? ` (${accessoriesOn})` : ''}`} open={openSections.accessories} onToggle={() => toggleSection('accessories')}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('customOrderPkgLockType')}>
                  <select value={draft.spec.lockType} onChange={(e) => patch({ lockType: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {LOCK_TYPES.map((g) => <option key={g} value={g}>{t(lockTypeKey(g) as any)}</option>)}
                  </select>
                </Field>
                <Field label={t('customOrderPkgHandleType')}>
                  <select value={draft.spec.handleType} onChange={(e) => patch({ handleType: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {HANDLE_TYPES.map((g) => <option key={g} value={g}>{t(handleTypeKey(g) as any)}</option>)}
                  </select>
                </Field>
                <Field label={t('customOrderPkgHingeType')}>
                  <select value={draft.spec.hingeType} onChange={(e) => patch({ hingeType: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {HINGE_TYPES.map((g) => <option key={g} value={g}>{t(hingeTypeKey(g) as any)}</option>)}
                  </select>
                </Field>
                <Field label={t('customOrderPkgOpenDirection')}>
                  <select value={draft.spec.openDirection} onChange={(e) => patch({ openDirection: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {OPEN_DIRECTIONS.map((g) => <option key={g} value={g}>{t(openDirectionKey(g) as any)}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ACCESSORY_KEYS.map((k) => {
                  const on = (draft.spec.accessories as any)[k];
                  return (
                    <button key={k} type="button" onClick={() => patchAccessories(k, !on)} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${on ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm shadow-violet-200/40 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-200' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800'}`} aria-pressed={on}>
                      <span className="truncate">{t(accessoryKey(k) as any)}</span>
                      <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${on ? 'bg-violet-500 justify-end' : 'bg-slate-300 justify-start dark:bg-slate-600'}`}>
                        <span className="h-4 w-4 rounded-full bg-white shadow" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Accordion>

          {/* 7. Manufacturing notes */}
          <Accordion title={t('customOrderBuilderManufacturingNotes')} open={openSections.notes} onToggle={() => toggleSection('notes')}>
            <textarea value={draft.spec.productionNotes} onChange={(e) => patch({ productionNotes: e.target.value })} rows={4} className={`${inputCls} resize-none`} placeholder={t('customOrderPkgNotesPlaceholder')} />
          </Accordion>

          {/* 8. Attachments */}
          <Accordion title={t('customOrderBuilderAttachmentsFiles')} open={openSections.attachments} onToggle={() => toggleSection('attachments')}>
            <CardAttachments
              files={draft.attachments ?? []}
              externalLink={draft.externalLink ?? ''}
              onAddFiles={(files) => onChange({ ...draft, attachments: [...(draft.attachments ?? []), ...files] })}
              onRemoveFile={(idx) => onChange({ ...draft, attachments: (draft.attachments ?? []).filter((_, i) => i !== idx) })}
              onLinkChange={(v) => onChange({ ...draft, externalLink: v })}
            />
          </Accordion>
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="rounded-xl bg-linear-to-r from-violet-50 to-fuchsia-50 p-3 dark:from-violet-950/30 dark:to-fuchsia-950/30">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('customOrderCardEstimatedPrice')}</label>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-200/60 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>
                {t('customOrderCardHiddenFromEmployees')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} step="0.01" dir="ltr" value={draft.estimatedPrice} onChange={(e) => onChange({ ...draft, estimatedPrice: e.target.value })} className={inputCls} placeholder="0.00" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ILS</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{t('customOrderCardPriceCustomerOnly')}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">{t('cancel')}</button>
            <button type="button" onClick={onSubmit} disabled={!draft.spec.productType} className="flex-1 rounded-lg bg-linear-to-r from-violet-600 to-fuchsia-500 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/30 transition hover:from-violet-500 hover:to-fuchsia-400 disabled:opacity-50">
              {isEditing ? t('customOrderBuilderSubmitUpdate') : t('customOrderBuilderSubmitCreate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Accordion: React.FC<{ title: string; open: boolean; onToggle: () => void; tone?: 'amber' | 'blue'; children: React.ReactNode }> = ({ title, open, onToggle, tone, children }) => {
  const headerTint = tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : tone === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200';
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
      <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold ${headerTint}`}>
        <span>{title}</span>
        <svg className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">{children}</div>}
    </div>
  );
};

const CardAttachments: React.FC<{
  files: File[];
  externalLink: string;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (idx: number) => void;
  onLinkChange: (v: string) => void;
}> = ({ files, externalLink, onAddFiles, onRemoveFile, onLinkChange }) => {
  const { t } = useApp();
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const techRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <FilePickerButton onClick={() => imgRef.current?.click()} label={t('customOrderPkgAttachImages')} tone="emerald" />
        <FilePickerButton onClick={() => pdfRef.current?.click()} label={t('customOrderPkgAttachPdfs')} tone="rose" />
        <FilePickerButton onClick={() => techRef.current?.click()} label={t('customOrderPkgAttachTechnical')} tone="violet" />
        <input ref={imgRef} type="file" multiple accept=".jpg,.jpeg,.png,.heic" className="hidden" onChange={(e) => { onAddFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input ref={pdfRef} type="file" multiple accept=".pdf" className="hidden" onChange={(e) => { onAddFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input ref={techRef} type="file" multiple accept=".dwg,.dxf,.svg" className="hidden" onChange={(e) => { onAddFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, idx) => (
            <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700/60">
              <span className="truncate text-slate-700 dark:text-slate-200">
                {f.name}
                <span className="ms-2 text-[10px] text-slate-500 dark:text-slate-400">{(f.size / 1024).toFixed(1)} KB</span>
              </span>
              <button type="button" onClick={() => onRemoveFile(idx)} className="rounded border border-rose-200 px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300">×</button>
            </li>
          ))}
        </ul>
      )}

      <Field label={t('customOrderPkgAttachLink')} full>
        <input type="url" dir="ltr" value={externalLink} onChange={(e) => onLinkChange(e.target.value)} placeholder={t('customOrderPkgAttachLinkPlaceholder')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
      </Field>
    </div>
  );
};

const FilePickerButton: React.FC<{ onClick: () => void; label: string; tone: 'emerald' | 'rose' | 'violet' }> = ({ onClick, label, tone }) => {
  const cls = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
    rose: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200',
    violet: 'border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200',
  }[tone];
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-start gap-1 rounded-xl border-2 border-dashed p-3 text-start text-[11px] font-medium transition ${cls}`}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
      <span className="line-clamp-2">{label}</span>
    </button>
  );
};
