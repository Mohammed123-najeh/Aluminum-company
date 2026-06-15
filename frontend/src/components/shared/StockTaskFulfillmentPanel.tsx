import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiFulfillTaskResponse, ApiInventoryOffer } from '../../services/api';
import { salesApi } from '../../services/api';
import { formatIls } from '../../utils/currency';
// Full brand logo (gold pearl + waves + EN/AR wordmark). One asset gives both the
// logo and the company name on the printed receipt — Vite fingerprints/bundles it.
import brandLogoFull from '../../assets/brand-logo-full.jpeg';

export type CartLine = {
  inventoryId: number;
  offer: ApiInventoryOffer;
  quantity: number;
};

export type ReceiptCustomerInfo = {
  customerName?: string | null;
  customerPhone?: string | null;
  clientLabel?: string | null;
};

/**
 * Scope of the catalog shown by the panel.
 * - `aluminum` (default): hides ACCESSORIES rows so the supervisor sees only aluminum products.
 * - `accessories`: shows ONLY ACCESSORIES rows (and disables the user-facing category filter).
 * - `all`: no scoping (legacy behavior used by employee inventory/sales views).
 */
export type CatalogScope = 'aluminum' | 'accessories' | 'all';

const ACCESSORIES_CATEGORY_CODE = 'ACCESSORIES';

export type StockTaskFulfillmentPanelProps = {
  /** Supervisor: full pricing and receipt. Employee: selection only, no prices/totals. */
  mode: 'supervisor' | 'employee';
  /** When set with `delegatedFulfill`, parent saves cart on task create. When set without delegate, shows Issue receipt in-panel (edit task). */
  taskId: string | null;
  taskTitle: string;
  /** When true (new task in TaskModal), parent calls fulfill after POST /tasks — hide Issue receipt here. */
  delegatedFulfill?: boolean;
  /** Cart snapshot for parent (create task + fulfill). */
  onCartChange?: (cart: CartLine[], customerRef: string) => void;
  /** After successful fulfill (modal or in-panel). */
  onFulfilled?: () => void | Promise<void>;
  /** e.g. close parent modal after employee success. */
  onClose?: () => void;
  /** `fullscreen` = task wizard / supervisor stock popup (tall lists). `embedded` = compact (default). */
  variant?: 'embedded' | 'fullscreen';
  /** Shown on printed-style receipt (supervisor). */
  receiptCustomerInfo?: ReceiptCustomerInfo;
  /** After supervisor dismisses success receipt (fullscreen wizard). */
  onReceiptDismiss?: () => void;
  /** Restrict the catalog to aluminum or accessories. Defaults to `all` to keep existing callers unchanged. */
  catalogScope?: CatalogScope;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** API may return decimals as strings; coerce so stock math and disabled states work. */
function normalizeInventoryOffer(o: ApiInventoryOffer): ApiInventoryOffer {
  return {
    ...o,
    inventoryId: Number(o.inventoryId) || 0,
    profileId: Number(o.profileId) || 0,
    quantity: Math.max(0, Math.floor(Number(o.quantity) || 0)),
    unitPrice: Number(o.unitPrice) || 0,
  };
}

export const StockTaskFulfillmentPanel: React.FC<StockTaskFulfillmentPanelProps> = ({
  mode,
  taskId,
  taskTitle,
  delegatedFulfill = false,
  onCartChange,
  onFulfilled,
  onClose,
  variant = 'embedded',
  receiptCustomerInfo,
  onReceiptDismiss,
  catalogScope = 'all',
}) => {
  const { t, token } = useApp();
  const [offers, setOffers] = useState<ApiInventoryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerRef, setCustomerRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApiFulfillTaskResponse | null>(null);
  const [employeeSuccess, setEmployeeSuccess] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ApiInventoryOffer | null>(null);
  const [customQty, setCustomQty] = useState<string>('1');
  const [showFulfillConfirm, setShowFulfillConfirm] = useState(false);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const showPricing = mode === 'supervisor';
  const isFullscreen = variant === 'fullscreen';

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await salesApi.inventoryOffers(token);
        if (!cancelled) setOffers(data.map(normalizeInventoryOffer));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    onCartChange?.(cart, customerRef);
  }, [cart, customerRef, onCartChange]);

  // Reset narrow filters whenever the wizard scope flips so a leftover category/color
  // selection from one scope doesn't make the other look empty.
  useEffect(() => {
    setCategoryFilter('');
    setColorFilter('');
    setSelectedOffer(null);
  }, [catalogScope]);

  /** Offers narrowed by the wizard scope (aluminum vs accessories) before any user filter. */
  const scopedOffers = useMemo(() => {
    if (catalogScope === 'all') return offers;
    if (catalogScope === 'accessories') {
      return offers.filter((o) => (o.categoryCode || '') === ACCESSORIES_CATEGORY_CODE);
    }
    return offers.filter((o) => (o.categoryCode || '') !== ACCESSORIES_CATEGORY_CODE);
  }, [offers, catalogScope]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const o of scopedOffers) {
      const c = o.categoryCode || o.categoryName;
      if (c) s.add(String(c));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [scopedOffers]);

  const colorOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of scopedOffers) {
      m.set(o.colorCode, o.colorName);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([code, name]) => ({ code, name }));
  }, [scopedOffers]);

  const filtered = useMemo(() => {
    const q = norm(search);
    let list = scopedOffers;
    if (categoryFilter) {
      list = list.filter((o) => (o.categoryCode || o.categoryName || '') === categoryFilter);
    }
    if (colorFilter) {
      list = list.filter((o) => o.colorCode === colorFilter);
    }
    if (!q) return list;
    return list.filter((o) => {
      const blob = [o.profileName, o.profileCode, o.categoryName ?? '', o.usage ?? '', o.colorName, o.colorCode].join(' ');
      return norm(blob).includes(q);
    });
  }, [scopedOffers, search, categoryFilter, colorFilter]);

  const cartQtyFor = useCallback(
    (id: number) => cart.filter((l) => l.inventoryId === id).reduce((a, l) => a + l.quantity, 0),
    [cart],
  );

  const addQty = useCallback(
    (offer: ApiInventoryOffer, qty: number) => {
      const q = Math.floor(qty);
      if (q < 1) return;
      const current = cartQtyFor(offer.inventoryId);
      if (current + q > offer.quantity) return;
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.inventoryId === offer.inventoryId);
        if (idx === -1) {
          return [...prev, { inventoryId: offer.inventoryId, offer, quantity: q }];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + q };
        return next;
      });
    },
    [cartQtyFor],
  );

  const setLineQty = useCallback((inventoryId: number, qty: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.inventoryId === inventoryId);
      if (!line) return prev;
      const q = Math.min(Math.max(0, Math.floor(qty)), line.offer.quantity);
      if (q <= 0) return prev.filter((l) => l.inventoryId !== inventoryId);
      return prev.map((l) => (l.inventoryId === inventoryId ? { ...l, quantity: q } : l));
    });
  }, []);

  const removeLine = useCallback((inventoryId: number) => {
    setCart((prev) => prev.filter((l) => l.inventoryId !== inventoryId));
  }, []);

  const addCustomQty = useCallback(() => {
    if (!selectedOffer) return;
    const avail = Math.max(0, selectedOffer.quantity - cartQtyFor(selectedOffer.inventoryId));
    const q = parseInt(customQty.replace(',', '.'), 10);
    if (!Number.isFinite(q) || q < 1) return;
    const useQty = Math.min(q, avail);
    if (useQty < 1) return;
    addQty(selectedOffer, useQty);
  }, [selectedOffer, customQty, cartQtyFor, addQty]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity * l.offer.unitPrice, 0),
    [cart],
  );

  useEffect(() => {
    if (showPaymentStep && showPricing) {
      setAmountPaidNow(String(round2(cartTotal)));
      setSubmitError(null);
    }
  }, [showPaymentStep, showPricing, cartTotal]);

  const runFulfill = async () => {
    if (!token || !taskId || cart.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const total = round2(cartTotal);
      let initialPaid = 0;
      if (showPricing) {
        const parsed = parseFloat(amountPaidNow.replace(',', '.'));
        initialPaid = Number.isFinite(parsed) ? round2(Math.max(0, parsed)) : 0;
        if (initialPaid > total + 0.001) {
          setSubmitError(t('salesPaymentExceedsTotal'));
          setSubmitting(false);
          return;
        }
      }

      const res = await salesApi.fulfillTask(
        {
          task_id: taskId,
          customer_reference: customerRef.trim() || undefined,
          items: cart.map((l) => ({ inventory_id: l.inventoryId, quantity: l.quantity })),
          ...(showPricing
            ? {
                initial_amount_paid: initialPaid,
                payment_due_at: paymentDueDate.trim() || null,
                payment_notes: paymentNotes.trim() || undefined,
              }
            : {}),
        },
        token,
      );
      setShowFulfillConfirm(false);
      setShowPaymentStep(false);
      if (mode === 'employee') {
        setCart([]);
        await onFulfilled?.();
        setEmployeeSuccess(true);
      } else {
        setReceipt(res);
        await onFulfilled?.();
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const showInPanelFulfill = taskId && !delegatedFulfill && cart.length > 0;

  if (employeeSuccess && mode === 'employee') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{t('salesEmployeeFulfillSuccess')}</p>
        <button
          type="button"
          onClick={() => {
            setEmployeeSuccess(false);
            onClose?.();
          }}
          className="mt-3 text-sm font-medium text-emerald-800 underline dark:text-emerald-300"
        >
          {t('close')}
        </button>
      </div>
    );
  }

  if (receipt && mode === 'supervisor') {
    const rc = receiptCustomerInfo;
    // Print only the receipt card: a body class flips on the global @media print
    // rules (style.css) that hide all app chrome — the surrounding modal header,
    // buttons and backdrop no longer bleed onto the page.
    const handlePrintReceipt = () => {
      document.body.classList.add('printing-receipt');
      const cleanup = () => {
        document.body.classList.remove('printing-receipt');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
    };
    const receiptWrap = isFullscreen
      ? 'receipt-printable mx-auto max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900'
      : 'receipt-printable rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900';
    return (
      <div className={receiptWrap}>
        {/* Company logo + name (image already contains the EN/AR wordmark). */}
        <div className="mb-3 flex justify-center border-b border-slate-200 pb-3 dark:border-slate-700">
          <img
            src={brandLogoFull}
            alt="Aluminum Pearl Co."
            className="h-20 w-auto object-contain"
            decoding="async"
            draggable={false}
          />
        </div>
        <div className="border-b border-slate-200 pb-3 text-center dark:border-slate-700">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t('salesReceiptTitle')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{receipt.receiptNumber}</p>
          <p className="text-xs text-slate-500">{new Date(receipt.issuedAt).toLocaleString()}</p>
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">{taskTitle}</p>
          {(rc?.customerName || rc?.customerPhone || rc?.clientLabel) && (
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-start text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {rc?.customerName ? (
                <p>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{t('taskCustomerNameLabel')}: </span>
                  {rc.customerName}
                </p>
              ) : null}
              {rc?.customerPhone ? (
                <p>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{t('taskCustomerPhoneLabel')}: </span>
                  {rc.customerPhone}
                </p>
              ) : null}
              {rc?.clientLabel ? (
                <p>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{t('receiptClientName')}: </span>
                  {rc.clientLabel}
                </p>
              ) : null}
            </div>
          )}
          {receipt.customerReference && (
            <p className="mt-2 text-xs text-slate-500">
              {t('customerReference')}: {receipt.customerReference}
            </p>
          )}
        </div>
        <ul className={`mt-3 space-y-2 text-sm ${isFullscreen ? 'max-h-64' : 'max-h-48'} overflow-y-auto print:max-h-none print:overflow-visible`}>
          {receipt.lines.map((ln, i) => (
            <li key={i} className="border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex justify-between gap-2 font-medium text-slate-800 dark:text-slate-200">
                <span className="min-w-0">{ln.profileName}</span>
                <span className="shrink-0 tabular-nums text-indigo-600 dark:text-indigo-400">{formatIls(ln.lineTotal)}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {ln.colorName} · {ln.quantity} {t('unitsShort')} × {formatIls(ln.unitPrice)} / {t('unitsShort')}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-slate-700">
          <span>{t('salesReceiptTotal')}</span>
          <span className="tabular-nums">
            {formatIls(receipt.totalAmount)} {receipt.currency}
          </span>
        </div>
        {(receipt.amountPaid != null || receipt.balanceDue != null || receipt.paymentStatus) && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50">
            {receipt.amountPaid != null && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-400">{t('salesReceiptAmountPaid')}</span>
                <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatIls(receipt.amountPaid)} {receipt.currency}
                </span>
              </div>
            )}
            {receipt.balanceDue != null && receipt.balanceDue > 0.009 && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-400">{t('salesReceiptBalance')}</span>
                <span className="tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                  {formatIls(receipt.balanceDue)} {receipt.currency}
                </span>
              </div>
            )}
            {receipt.paymentDueAt && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t('salesReceiptPayBy')}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{receipt.paymentDueAt}</span>
              </div>
            )}
            {receipt.paymentStatus && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('salesReceiptPaymentStatus')}:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {receipt.paymentStatus === 'paid'
                    ? t('receiptStatusPaid')
                    : receipt.paymentStatus === 'partial'
                      ? t('receiptStatusPartial')
                      : receipt.paymentStatus === 'unpaid'
                        ? t('receiptStatusUnpaid')
                        : receipt.paymentStatus}
                </span>
              </p>
            )}
          </div>
        )}
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700"
          >
            {t('salesReceiptPrint')}
          </button>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              setPaymentDueDate('');
              setPaymentNotes('');
              setAmountPaidNow('');
              onReceiptDismiss?.();
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {t('close')}
          </button>
        </div>
      </div>
    );
  }

  const listShell = isFullscreen
    ? 'flex min-h-[min(40vh,320px)] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700'
    : 'flex min-h-[220px] max-h-72 flex-col overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800';

  const cartShell = isFullscreen
    ? 'flex min-h-[min(40vh,320px)] flex-1 flex-col rounded-xl border border-slate-200 dark:border-slate-700'
    : 'flex min-h-[220px] max-h-72 flex-col rounded-xl border border-slate-100 dark:border-slate-800';

  const selectedAvail = selectedOffer
    ? Math.max(0, selectedOffer.quantity - cartQtyFor(selectedOffer.inventoryId))
    : 0;

  const SelectedProductCard = selectedOffer ? (
    isFullscreen ? (
      <div className="shrink-0 rounded-lg border border-indigo-200/90 bg-indigo-50/70 px-3 py-2 dark:border-indigo-800/80 dark:bg-indigo-950/35">
        <div className="flex flex-wrap items-end gap-3 sm:items-center">
          <div className="min-w-0 flex-1 sm:min-w-[12rem]">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {t('salesSelectedProduct')}
            </p>
            <p className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {selectedOffer.profileName}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
              {selectedOffer.profileCode} · {selectedOffer.colorName} · {t('salesStock')}:{' '}
              {Number(selectedOffer.quantity)} {t('unitsShort')}
              {showPricing && ` · ${formatIls(selectedOffer.unitPrice)}/${t('unitsShort')}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2 sm:ms-auto">
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{t('quantityUnits')}</label>
              <input
                type="number"
                step={1}
                min={1}
                max={Math.max(1, selectedAvail)}
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <button
              type="button"
              disabled={selectedAvail < 1}
              onClick={addCustomQty}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {t('salesAddToCart')}
            </button>
          </div>
        </div>
        <p className="mt-1.5 border-t border-indigo-200/50 pt-1.5 text-[10px] text-slate-500 dark:border-indigo-900/50 dark:text-slate-400">
          {t('salesAvailableAfterCart').replace('{n}', String(selectedAvail))}
        </p>
      </div>
    ) : (
      <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/25">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{t('salesSelectedProduct')}</p>
        <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{selectedOffer.profileName}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {selectedOffer.profileCode} · {selectedOffer.colorName} · {t('salesStock')}: {Number(selectedOffer.quantity)} {t('unitsShort')}
          {showPricing && ` · ${formatIls(selectedOffer.unitPrice)}/${t('unitsShort')}`}
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] text-slate-500">{t('quantityUnits')}</label>
            <input
              type="number"
              step={1}
              min={1}
              max={Math.max(1, selectedAvail)}
              value={customQty}
              onChange={(e) => setCustomQty(e.target.value)}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <button
            type="button"
            disabled={selectedAvail < 1}
            onClick={addCustomQty}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {t('salesAddToCart')}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {t('salesAvailableAfterCart').replace('{n}', String(selectedAvail))}
        </p>
      </div>
    )
  ) : null;

  return (
    <div className={`space-y-3 ${isFullscreen ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={isFullscreen ? 'shrink-0' : ''}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t('salesDeskTitle')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('filterByCategory')}</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('allCategories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('filterByColor')}</label>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('allColors')}</option>
              {colorOptions.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mb-1 mt-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('salesSearchStock')}</label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('salesSearchPlaceholder')}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {!isFullscreen && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('salesSelectProductHint')}</p>}
      </div>

      <div
        className={`grid min-h-0 gap-3 ${isFullscreen ? 'min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 lg:gap-4' : 'grid-cols-1 lg:grid-cols-2'}`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:col-span-7 lg:min-h-0">
          {isFullscreen && (
            <p className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">{t('salesSelectProductHint')}</p>
          )}
          {SelectedProductCard}
          <div className={listShell}>
            {loading ? (
              <div className="flex flex-1 justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              </div>
            ) : loadError ? (
              <p className="p-4 text-sm text-red-600">{loadError}</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('noProductsMatch')}</p>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {filtered.map((o) => {
                  const reserved = cartQtyFor(o.inventoryId);
                  const stock = Number(o.quantity) || 0;
                  const avail = Math.max(0, stock - reserved);
                  const isSel = selectedOffer?.inventoryId === o.inventoryId;
                  return (
                    <li
                      key={o.inventoryId}
                      className={`flex flex-wrap items-stretch gap-0 sm:flex-nowrap ${
                        isSel ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOffer(o);
                          setCustomQty('1');
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded-none p-2.5 text-start text-sm text-slate-900 outline-none transition hover:bg-slate-50/80 focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 dark:text-slate-100 dark:hover:bg-slate-800/50"
                      >
                        <p className="pointer-events-none font-medium">{o.profileName}</p>
                        <p className="pointer-events-none text-xs text-slate-500">
                          {o.profileCode} · {o.colorName} · {t('salesStock')}: {stock} {t('unitsShort')}
                        </p>
                        {o.usage && <p className="pointer-events-none mt-0.5 text-[11px] text-slate-400">{o.usage}</p>}
                        {showPricing && (
                          <p className="pointer-events-none mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {t('salesPricePerUnit')}: {formatIls(o.unitPrice)}
                          </p>
                        )}
                      </button>
                      <div className="flex shrink-0 flex-col items-end justify-center gap-1 border-s border-slate-100 px-2 py-2 dark:border-slate-800">
                        <div className="flex flex-wrap justify-end gap-1">
                          {[1, 2, 3, 4].map((n) => (
                            <button
                              key={n}
                              type="button"
                              disabled={avail < n}
                              onClick={(e) => {
                                e.stopPropagation();
                                addQty(o, n);
                              }}
                              className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-950"
                            >
                              +{n}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={avail < 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (avail >= 1) addQty(o, 1);
                          }}
                          className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {t('salesAddOneM')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className={`${cartShell} ${isFullscreen ? 'lg:col-span-5' : ''}`}>
          <h3 className="shrink-0 border-b border-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-200">
            {t('salesCart')}
          </h3>
          <label className={`shrink-0 pt-2 text-xs text-slate-500 ${isFullscreen ? 'px-3' : 'px-2'}`}>{t('customerReference')}</label>
          <input
            value={customerRef}
            onChange={(e) => setCustomerRef(e.target.value)}
            placeholder={t('salesOptionalRef')}
            className={`mb-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${isFullscreen ? 'mx-3' : 'mx-2'}`}
          />
          <div className={`min-h-0 flex-1 overflow-y-auto ${isFullscreen ? 'px-3' : 'px-2'}`}>
            {cart.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-400">{t('salesCartEmpty')}</p>
            ) : (
              <ul className="space-y-2 pb-2">
                {cart.map((line) => (
                  <li
                    key={line.inventoryId}
                    className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{line.offer.profileName}</p>
                      <p className="text-xs text-slate-500">
                        {line.offer.colorName}
                        {showPricing && ` @ ${formatIls(line.offer.unitPrice)}/${t('unitsShort')}`}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <label className="text-[11px] text-slate-500">{t('quantityUnits')}:</label>
                        <input
                          type="number"
                          step={1}
                          min={1}
                          max={line.offer.quantity}
                          value={line.quantity}
                          onChange={(e) => setLineQty(line.inventoryId, parseInt(e.target.value, 10) || 0)}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                      </div>
                    </div>
                    <div className="text-end">
                      {showPricing && (
                        <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatIls(line.quantity * line.offer.unitPrice)}
                        </p>
                      )}
                      <button type="button" onClick={() => removeLine(line.inventoryId)} className="mt-1 text-xs text-red-600 hover:underline">
                        {t('delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {showPricing && (
            <div className={`shrink-0 border-t border-slate-200 py-2 dark:border-slate-700 ${isFullscreen ? 'px-3' : 'px-2'}`}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-slate-700 dark:text-slate-300">{t('salesCartTotal')}</span>
                <span className="tabular-nums text-indigo-600 dark:text-indigo-400">{formatIls(cartTotal)}</span>
              </div>
            </div>
          )}
          {submitError && (
            <p className={`shrink-0 pb-2 text-sm text-red-600 ${isFullscreen ? 'px-3' : 'px-2'}`}>{submitError}</p>
          )}
          {showInPanelFulfill && (
            <div className={`shrink-0 border-t border-slate-200 dark:border-slate-700 ${isFullscreen ? 'p-3' : 'p-2'}`}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setSubmitError(null);
                  setShowFulfillConfirm(true);
                }}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50"
              >
                {mode === 'employee' ? t('salesCompleteFromStock') : t('salesGenerateReceipt')}
              </button>
            </div>
          )}
        </div>
      </div>

      {delegatedFulfill && cart.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('taskStockIncludedOnSave')}</p>
      )}

      {showFulfillConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label={t('close')}
            disabled={submitting}
            onClick={() => !submitting && setShowFulfillConfirm(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('salesConfirmFulfillTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('salesConfirmFulfillHint')}</p>
            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
              {cart.map((line) => (
                <li key={line.inventoryId} className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="min-w-0 text-slate-700 dark:text-slate-300">
                    {line.offer.profileName} · {line.offer.colorName} · {line.quantity} {t('unitsShort')}
                  </span>
                  {showPricing && (
                    <span className="shrink-0 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatIls(line.quantity * line.offer.unitPrice)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {showPricing && (
              <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold dark:border-slate-700">
                <span>{t('salesCartTotal')}</span>
                <span className="tabular-nums text-indigo-600 dark:text-indigo-400">{formatIls(cartTotal)}</span>
              </div>
            )}
            {customerRef.trim() && (
              <p className="mt-2 text-xs text-slate-500">
                {t('customerReference')}: {customerRef.trim()}
              </p>
            )}
            {submitError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{submitError}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowFulfillConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (mode === 'employee') void runFulfill();
                  else {
                    setShowFulfillConfirm(false);
                    setShowPaymentStep(true);
                  }
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? '…' : mode === 'employee' ? t('salesConfirmCompleteTask') : t('salesContinueToPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentStep && showPricing && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label={t('close')}
            disabled={submitting}
            onClick={() => !submitting && setShowPaymentStep(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('salesPaymentStepTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('salesPaymentStepHint')}</p>
            <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t('salesCartTotal')}: <span className="tabular-nums text-indigo-600 dark:text-indigo-400">{formatIls(cartTotal)}</span>
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('salesAmountPaidNow')}</label>
            <input
              type="text"
              inputMode="decimal"
              value={amountPaidNow}
              onChange={(e) => setAmountPaidNow(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t('salesBalanceRemaining')}:{' '}
              <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">
                {formatIls(
                  Math.max(
                    0,
                    round2(cartTotal) -
                      round2(parseFloat(amountPaidNow.replace(',', '.')) || 0),
                  ),
                )}
              </span>
            </p>
            <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('salesPaymentDueDate')}</label>
            <input
              type="date"
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('salesPaymentScheduleNotes')}</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {submitError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{submitError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowPaymentStep(false);
                  setShowFulfillConfirm(true);
                }}
                className="flex-1 min-w-[6rem] rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('salesBackToLineReview')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowPaymentStep(false)}
                className="flex-1 min-w-[6rem] rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void runFulfill()}
                className="flex-[2] min-w-[10rem] rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? '…' : t('salesConfirmIssueReceipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
