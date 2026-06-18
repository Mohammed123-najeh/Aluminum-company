import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiOrder } from '../../services/api';
import { formatIls } from '../../utils/currency';

type Props = {
  orders: ApiOrder[];
  loading: boolean;
  error: string | null;
  cancelOrder: (id: string, payload: { type: 'full' | 'partial'; item_ids?: string[]; reason?: string | null }) => Promise<ApiOrder | undefined>;
  uncancelOrder?: (id: string) => Promise<ApiOrder | undefined>;
};

function customerName(order: ApiOrder): string {
  return order.clientName ?? order.taskCustomerName ?? order.customerReference ?? '—';
}

function cancellationLabel(order: ApiOrder, isAr: boolean): string | null {
  if (order.cancellationType === 'full' || order.status === 'cancelled') {
    return isAr ? 'ملغي كامل' : 'Fully cancelled';
  }
  if (order.cancellationType === 'partial') {
    return isAr ? 'ملغي جزئياً' : 'Partially cancelled';
  }
  return null;
}

export const SupervisorOrders: React.FC<Props> = ({ orders, loading, error, cancelOrder, uncancelOrder }) => {
  const { t, lang } = useApp();
  const isAr = lang === 'ar';
  const [detail, setDetail] = useState<ApiOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ApiOrder | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (order: ApiOrder) => {
    if (!uncancelOrder) return;
    const ok = window.confirm(isAr
      ? 'تراجع عن الإلغاء واستعادة هذه الطلبية إلى حالتها السابقة؟'
      : 'Undo the cancellation and restore this order to its previous state?');
    if (!ok) return;
    setRestoringId(order.id);
    try {
      const updated = await uncancelOrder(order.id);
      if (updated) setDetail((cur) => (cur?.id === updated.id ? updated : cur));
    } finally {
      setRestoringId(null);
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
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {isAr ? 'يمكنك مراجعة الطلبات وإلغاء الطلب كاملاً أو اختيار عناصر محددة للإلغاء الجزئي.' : 'Review orders and cancel either the full order or selected line items.'}
      </p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">{t('noOrdersYet')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cancelled = cancellationLabel(order, isAr);
            const isRed = Boolean(cancelled);
            const activeItems = order.items.filter((item) => !item.isCancelled).length;
            return (
              <article
                key={order.id}
                className={`w-full rounded-xl border p-5 text-start shadow-sm transition ${
                  isRed
                    ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/20'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {t('orderNumberLabel').replace('{id}', order.receiptNumber ?? order.id)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {customerName(order)} · {order.creatorName}
                    </p>
                    {order.taskTitle && (
                      <p className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        {t('linkedTask')}: {order.taskTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {cancelled && (
                      <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                        {cancelled}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
                  <Metric label={isAr ? 'الإجمالي' : 'Total'} value={formatIls(order.totalAmount ?? 0)} />
                  <Metric label={isAr ? 'المدفوع' : 'Paid'} value={formatIls(order.amountPaid ?? 0)} tone="emerald" />
                  <Metric label={isAr ? 'المتبقي' : 'Balance'} value={formatIls(order.balanceDue ?? 0)} tone="amber" />
                  <Metric label={isAr ? 'المسترجع' : 'Refunded'} value={formatIls(order.refundedAmount ?? 0)} tone="rose" />
                </div>

                <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  {order.items.slice(0, 3).map((item) => (
                    <li key={item.id} className={item.isCancelled ? 'text-rose-600 line-through dark:text-rose-300' : ''}>
                      {item.profileCode} {item.profileName} / {item.colorName} × {item.quantity} {t('unitsShort')}
                      {item.lineTotal != null && <span className="ms-2 text-xs tabular-nums">({formatIls(item.lineTotal)})</span>}
                    </li>
                  ))}
                  {order.items.length > 3 && (
                    <li className="text-xs text-slate-400">{t('orderMoreItems').replace('{n}', String(order.items.length - 3))}</li>
                  )}
                </ul>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDetail(order)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {isAr ? 'عرض التفاصيل' : 'View details'}
                  </button>
                  {order.status !== 'cancelled' && activeItems > 0 && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(order)}
                      className="rounded-lg border border-rose-200 bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 dark:border-rose-900"
                    >
                      {isAr ? 'إلغاء الطلبية' : 'Cancel order'}
                    </button>
                  )}
                  {/* Undo a full cancellation — restores the order + its task. */}
                  {(order.status === 'cancelled' || order.cancellationType === 'full') && uncancelOrder && (
                    <button
                      type="button"
                      disabled={restoringId === order.id}
                      onClick={() => void handleRestore(order)}
                      className="rounded-lg border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-900"
                    >
                      {restoringId === order.id ? '…' : isAr ? 'تراجع عن الإلغاء' : 'Undo cancellation'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {detail && (
        <OrderDetailModal order={detail} isAr={isAr} onClose={() => setDetail(null)} />
      )}
      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          isAr={isAr}
          onClose={() => setCancelTarget(null)}
          onSubmit={async (payload) => {
            const updated = await cancelOrder(cancelTarget.id, payload);
            if (updated) {
              setDetail((current) => (current?.id === updated.id ? updated : current));
              setCancelTarget(null);
            }
          }}
        />
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: 'emerald' | 'amber' | 'rose' }> = ({ label, value, tone }) => {
  const color =
    tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'amber' ? 'text-amber-700 dark:text-amber-300'
        : tone === 'rose' ? 'text-rose-700 dark:text-rose-300'
          : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-lg border border-slate-100 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
};

const OrderDetailModal: React.FC<{ order: ApiOrder; isAr: boolean; onClose: () => void }> = ({ order, isAr, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {isAr ? 'تفاصيل الطلبية' : 'Order details'}
      </h2>
      {cancellationLabel(order, isAr) && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <p className="font-bold">{cancellationLabel(order, isAr)}</p>
          <p className="mt-1 text-xs">
            {isAr ? 'المبلغ الملغى' : 'Cancelled'}: {formatIls(order.cancelledAmount ?? 0)} · {isAr ? 'المسترجع' : 'Refunded'}: {formatIls(order.refundedAmount ?? 0)}
          </p>
          {order.cancellationReason && <p className="mt-1 text-xs">{order.cancellationReason}</p>}
        </div>
      )}
      <dl className="mt-4 space-y-2 text-sm">
        <Info label={isAr ? 'رقم الطلب' : 'Order'} value={`#${order.receiptNumber ?? order.id}`} />
        <Info label={isAr ? 'الحالة' : 'Status'} value={order.status} />
        <Info label={isAr ? 'الزبون' : 'Customer'} value={customerName(order)} />
        <Info label={isAr ? 'الإجمالي' : 'Total'} value={formatIls(order.totalAmount ?? 0)} />
        <Info label={isAr ? 'المدفوع' : 'Paid'} value={formatIls(order.amountPaid ?? 0)} />
        <Info label={isAr ? 'المتبقي' : 'Balance'} value={formatIls(order.balanceDue ?? 0)} />
      </dl>
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {isAr ? 'العناصر' : 'Items'}
      </h3>
      <ul className="mt-2 space-y-2">
        {order.items.map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              item.isCancelled
                ? 'border-rose-200 bg-rose-50/80 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
                : 'border-slate-100 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/40'
            }`}
          >
            <span className="font-medium">
              {item.profileCode} {item.profileName}
            </span>
            <span className="text-slate-600 dark:text-slate-400"> · {item.colorName}</span>
            <span className="block text-slate-600 dark:text-slate-400">
              {item.quantity} {isAr ? 'وحدة' : 'units'} · {formatIls(item.lineTotal ?? 0)}
            </span>
            {item.isCancelled && <p className="mt-1 text-xs font-semibold">{isAr ? 'ملغى' : 'Cancelled'}</p>}
            {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
      >
        {isAr ? 'إغلاق' : 'Close'}
      </button>
    </div>
  </div>
);

const Info: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="text-end font-medium text-slate-900 dark:text-slate-100">{value}</dd>
  </div>
);

const CancelOrderModal: React.FC<{
  order: ApiOrder;
  isAr: boolean;
  onClose: () => void;
  onSubmit: (payload: { type: 'full' | 'partial'; item_ids?: string[]; reason?: string | null }) => Promise<void>;
}> = ({ order, isAr, onClose, onSubmit }) => {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeItems = useMemo(() => order.items.filter((item) => !item.isCancelled), [order.items]);
  const selectedAmount = useMemo(() => {
    if (mode === 'full') return order.totalAmount ?? activeItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
    return activeItems
      .filter((item) => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  }, [activeItems, mode, order.totalAmount, selectedIds]);
  const currentTotal = order.totalAmount ?? 0;
  const currentPaid = order.amountPaid ?? 0;
  const nextTotal = mode === 'full' ? 0 : Math.max(0, currentTotal - selectedAmount);
  const refund = Math.max(0, currentPaid - Math.min(currentPaid, nextTotal));
  const disabled = saving || (mode === 'partial' && selectedIds.length === 0);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSubmit({
        type: mode,
        item_ids: mode === 'partial' ? selectedIds : undefined,
        reason: reason.trim() || null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : (isAr ? 'فشل إلغاء الطلبية' : 'Failed to cancel order'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-4 dark:border-rose-900/50 dark:bg-rose-950/30">
          <h2 className="text-base font-bold text-rose-900 dark:text-rose-100">
            {isAr ? 'إلغاء الطلبية' : 'Cancel order'}
          </h2>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">
            {order.receiptNumber ?? `ORD-${order.id}`} · {customerName(order)}
          </p>
        </div>

        <div className="space-y-4 p-5">
          {err && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {err}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {(['full', 'partial'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-xl border px-4 py-3 text-start text-sm transition ${
                  mode === value
                    ? 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-900/50'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="font-bold">{value === 'full' ? (isAr ? 'إلغاء كامل' : 'Full cancellation') : (isAr ? 'إلغاء جزئي' : 'Partial cancellation')}</span>
                <span className="mt-1 block text-xs opacity-75">
                  {value === 'full'
                    ? (isAr ? 'يلغي كل العناصر ويصفر الرصيد.' : 'Cancels all items and clears the balance.')
                    : (isAr ? 'اختر العناصر التي تريد إلغاءها فقط.' : 'Choose only the items to cancel.')}
                </span>
              </button>
            ))}
          </div>

          {mode === 'partial' && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                {isAr ? 'اختر العناصر الملغاة' : 'Select cancelled items'}
              </h3>
              <div className="space-y-2">
                {activeItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                          {item.profileCode} {item.profileName}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {item.colorName} · {item.quantity} {isAr ? 'وحدة' : 'units'}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatIls(item.lineTotal ?? 0)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{isAr ? 'سبب الإلغاء' : 'Cancellation reason'}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder={isAr ? 'اختياري' : 'Optional'}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-4">
            <Metric label={isAr ? 'الإجمالي الحالي' : 'Current total'} value={formatIls(currentTotal)} />
            <Metric label={isAr ? 'المبلغ الملغى' : 'Cancelled'} value={formatIls(selectedAmount)} tone="rose" />
            <Metric label={isAr ? 'الإجمالي بعد الإلغاء' : 'New total'} value={formatIls(nextTotal)} />
            <Metric label={isAr ? 'يرجع للزبون' : 'Refund'} value={formatIls(refund)} tone="rose" />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/60 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {isAr ? 'رجوع' : 'Back'}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (isAr ? 'جاري الإلغاء...' : 'Cancelling...') : (isAr ? 'تأكيد الإلغاء' : 'Confirm cancellation')}
          </button>
        </div>
      </div>
    </div>
  );
};
