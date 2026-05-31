import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useOrders } from '../../hooks/useOrders';
import type { ApiOrder, ApiOrderItem, ApiOrderPayment } from '../../services/api';
import { formatIls } from '../../utils/currency';

const PAGE_SIZE = 8;

type Props = {
  showInnerHeading?: boolean;
  isActive?: boolean;
};

function uniqueCategories(items: ApiOrderItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    const c = it.categoryName?.trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function customerDisplayName(o: ApiOrder): string {
  return o.clientName?.trim() || o.taskCustomerName?.trim() || o.customerReference?.trim() || '—';
}

function paymentBadgeClass(status: string | undefined): string {
  if (status === 'paid') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (status === 'partial') return 'bg-orange-500/15 text-orange-900 dark:text-orange-200';
  if (status === 'unpaid') return 'bg-rose-500/15 text-rose-900 dark:text-rose-200';
  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
}

function isReceiptOverdue(o: ApiOrder): boolean {
  const bal = o.balanceDue ?? 0;
  if (bal < 0.01 || !o.paymentDueAt) return false;
  const end = new Date(`${o.paymentDueAt}T23:59:59`);
  return end.getTime() < Date.now();
}

function matchesDueFilter(o: ApiOrder, filter: string): boolean {
  const bal = o.balanceDue ?? 0;
  if (filter === 'has_balance') return bal > 0.009;
  if (filter === 'overdue') return isReceiptOverdue(o);
  if (filter === 'upcoming') {
    if (bal < 0.01 || !o.paymentDueAt) return false;
    const d = new Date(`${o.paymentDueAt}T12:00:00`);
    const now = Date.now();
    const week = now + 7 * 86400000;
    return d.getTime() >= now && d.getTime() <= week;
  }
  return true;
}

function printReceiptHtml(order: ApiOrder, labels: Record<string, string>): string {
  const lines = order.items
    .map((it) => {
      const parts = [it.profileName, it.colorName, `${it.quantity} ${labels.unitsShort ?? 'units'}`].filter(Boolean).join(' · ');
      const price = it.lineTotal != null ? formatIls(it.lineTotal) : '';
      return `<tr><td>${esc(parts)}</td><td style="text-align:right">${esc(price)}</td></tr>`;
    })
    .join('');
  const total = order.totalAmount != null ? formatIls(order.totalAmount) : '—';
  const paid = order.amountPaid != null ? formatIls(order.amountPaid) : '—';
  const due = order.balanceDue != null ? formatIls(order.balanceDue) : '—';
  const payBy = order.paymentDueAt ? esc(order.paymentDueAt) : '—';
  const st = order.paymentStatus ? esc(labels[`ps_${order.paymentStatus}`] ?? order.paymentStatus) : '—';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(
    order.receiptNumber ?? order.id,
  )}</title><style>
    body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#111}
    h1{font-size:1.25rem;margin:0 0 4px}
    .muted{color:#555;font-size:12px;margin-bottom:16px}
    table{border-collapse:collapse;width:100%;font-size:13px}
    th,td{border-bottom:1px solid #ddd;padding:8px 4px}
    th{text-align:left;font-size:11px;text-transform:uppercase;color:#666}
    .tot{margin-top:16px;font-size:14px}
    .tot strong{display:inline-block;min-width:120px}
  </style></head><body>
  <h1>${esc(labels.title)}</h1>
  <p class="muted">${esc(order.receiptNumber ?? `#${order.id.slice(0, 8)}`)} · ${esc(
    new Date(order.updatedAt).toLocaleString(),
  )}</p>
  <p class="muted">${esc(labels.customer)}: ${esc(customerDisplayName(order))}</p>
  <table><thead><tr><th>${esc(labels.colItem)}</th><th style="text-align:right">${esc(labels.colAmount)}</th></tr></thead><tbody>${lines}</tbody></table>
  <div class="tot"><strong>${esc(labels.total)}</strong> ${esc(total)}</div>
  <div class="tot"><strong>${esc(labels.paid)}</strong> ${esc(paid)}</div>
  <div class="tot"><strong>${esc(labels.due)}</strong> ${esc(due)}</div>
  <div class="tot"><strong>${esc(labels.payBy)}</strong> ${payBy}</div>
  <div class="tot"><strong>${esc(labels.payStatus)}</strong> ${st}</div>
  <p class="muted">${esc(labels.by)} ${esc(order.creatorName ?? '—')}</p>
  </body></html>`;
}

export const EmployeeSalesReceipts: React.FC<Props> = ({ showInnerHeading = true, isActive = true }) => {
  const { t, currentUser } = useApp();
  const { orders, loading, error, refetch, addOrderPayment, updateReceiptMeta, fetchOrderPayments } = useOrders();
  const [detailOrder, setDetailOrder] = useState<ApiOrder | null>(null);
  const [payHistory, setPayHistory] = useState<ApiOrderPayment[]>([]);
  const [payHistoryLoading, setPayHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dueFilter, setDueFilter] = useState<string>('');
  const [groupByCustomer, setGroupByCustomer] = useState(false);

  // Subsequent partial payments are recorded by Finance (accountant employees) or admins.
  // Supervisors set the initial total + paid amount at task creation only.
  const canEditPayment =
    currentUser?.role === 'admin'
    || (currentUser?.role === 'employee' && currentUser?.employeeType === 'accountant');

  useEffect(() => {
    if (isActive) void refetch();
  }, [isActive, refetch]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dueFilter, groupByCustomer]);

  const receipts = useMemo(
    () =>
      [...orders]
        .filter((o) => o.status === 'completed' && o.receiptNumber)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [orders],
  );

  const filtered = useMemo(() => {
    let list = receipts;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const rn = (o.receiptNumber ?? '').toLowerCase();
        const creator = (o.creatorName ?? '').toLowerCase();
        const taskCust = (o.taskCustomerName ?? '').toLowerCase();
        const clientN = (o.clientName ?? '').toLowerCase();
        const clientP = (o.clientPhone ?? '').toLowerCase();
        const cust = customerDisplayName(o).toLowerCase();
        return (
          rn.includes(q) ||
          creator.includes(q) ||
          taskCust.includes(q) ||
          clientN.includes(q) ||
          clientP.includes(q) ||
          cust.includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      });
    }
    if (statusFilter) {
      list = list.filter((o) => (o.paymentStatus ?? 'unknown') === statusFilter);
    }
    if (dueFilter) {
      list = list.filter((o) => matchesDueFilter(o, dueFilter));
    }
    if (groupByCustomer) {
      list = [...list].sort((a, b) => customerDisplayName(a).localeCompare(customerDisplayName(b)));
    }
    return list;
  }, [receipts, search, statusFilter, dueFilter, groupByCustomer]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    if (!detailOrder) {
      setPayHistory([]);
      return;
    }
    let cancelled = false;
    setPayHistoryLoading(true);
    void fetchOrderPayments(detailOrder.id)
      .then((rows) => {
        if (!cancelled) setPayHistory(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setPayHistory([]);
      })
      .finally(() => {
        if (!cancelled) setPayHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailOrder, fetchOrderPayments]);

  useEffect(() => {
    if (!detailOrder) return;
    const next = orders.find((o) => o.id === detailOrder.id);
    if (next) setDetailOrder(next);
  }, [orders, detailOrder?.id]);

  const openPrint = (order: ApiOrder) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const html = printReceiptHtml(order, {
      title: t('salesReceiptTitle'),
      colItem: t('receiptColItem'),
      colAmount: t('amountShort'),
      total: t('salesReceiptTotal'),
      paid: t('receiptAmountPaid'),
      due: t('receiptBalanceDue'),
      by: t('receiptCreatedBy'),
      customer: t('receiptTaskCustomer'),
      payBy: t('receiptPaymentDueDate'),
      payStatus: t('salesReceiptPaymentStatus'),
      ps_paid: t('receiptStatusPaid'),
      ps_partial: t('receiptStatusPartial'),
      ps_unpaid: t('receiptStatusUnpaid'),
      ps_unknown: '—',
      unitsShort: t('unitsShort'),
    });
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center py-6">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (receipts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        {t('salesNoReceiptsYet')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showInnerHeading && (
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('salesRecentReceipts')}</h3>
      )}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('receiptsSearchPlaceholder')}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">{t('receiptFilterPaymentStatus')}: {t('receiptFilterAllStatuses')}</option>
          <option value="paid">{t('receiptStatusPaid')}</option>
          <option value="partial">{t('receiptStatusPartial')}</option>
          <option value="unpaid">{t('receiptStatusUnpaid')}</option>
        </select>
        <select
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">{t('receiptFilterDue')}: {t('receiptDueAll')}</option>
          <option value="has_balance">{t('receiptDueHasBalance')}</option>
          <option value="overdue">{t('receiptDueOverdue')}</option>
          <option value="upcoming">{t('receiptDueUpcoming')}</option>
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
          <input type="checkbox" checked={groupByCustomer} onChange={(e) => setGroupByCustomer(e.target.checked)} className="rounded border-slate-300" />
          {t('receiptGroupByCustomer')}
        </label>
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('noProductsMatch')}</p>
      )}
      <ul className="space-y-2">
        {pageSlice.map((o, idx) => {
          const cust = customerDisplayName(o);
          const prevCust = idx > 0 ? customerDisplayName(pageSlice[idx - 1]) : null;
          const showGroupHead = groupByCustomer && cust !== prevCust;
          return (
            <li key={o.id}>
              {showGroupHead && (
                <p className="mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{cust}</p>
              )}
              <ReceiptRow
                order={o}
                onOpenDetails={() => setDetailOrder(o)}
                onPrint={() => openPrint(o)}
                canEditPayment={canEditPayment}
              />
            </li>
          );
        })}
      </ul>
      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {t('receiptsPagePrev')}
          </button>
          <span className="tabular-nums">
            {t('receiptsPageOf').replace('{page}', String(safePage)).replace('{total}', String(totalPages))}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {t('receiptsPageNext')}
          </button>
        </div>
      )}

      {detailOrder && (
        <ReceiptDetailModal
          order={detailOrder}
          payHistory={payHistory}
          payHistoryLoading={payHistoryLoading}
          onClose={() => setDetailOrder(null)}
          onRefreshHistory={() => {
            void fetchOrderPayments(detailOrder.id).then((rows) => setPayHistory(rows ?? []));
          }}
          onRefetchOrders={() => void refetch()}
          canEditPayment={canEditPayment}
          addOrderPayment={addOrderPayment}
          updateReceiptMeta={updateReceiptMeta}
        />
      )}
    </div>
  );
};

const ReceiptRow: React.FC<{
  order: ApiOrder;
  onOpenDetails: () => void;
  onPrint: () => void;
  canEditPayment: boolean;
}> = ({ order, onOpenDetails, onPrint, canEditPayment: _canEdit }) => {
  const { t } = useApp();
  const totalLabel = order.totalAmount != null ? formatIls(order.totalAmount) : '—';
  const statusBadge =
    order.paymentStatus === 'paid'
      ? t('receiptStatusPaid')
      : order.paymentStatus === 'partial'
        ? t('receiptStatusPartial')
        : order.paymentStatus === 'unpaid'
          ? t('receiptStatusUnpaid')
          : (order.paymentStatus ?? '—');

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={onOpenDetails}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {order.receiptNumber ?? `#${order.id.slice(0, 8)}`}
              </p>
              {order.paymentStatus && (
                <span className={`rounded-full px-2 py-px text-[10px] font-bold ${paymentBadgeClass(order.paymentStatus)}`}>
                  {statusBadge}
                </span>
              )}
              {isReceiptOverdue(order) && (
                <span className="rounded-full bg-rose-500/20 px-2 py-px text-[10px] font-bold text-rose-800 dark:text-rose-200">
                  {t('receiptDueOverdue')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {customerDisplayName(order)} · {new Date(order.updatedAt).toLocaleString()} · {order.items.length} {t('items')}
            </p>
            {order.paymentDueAt && (
              <p className="text-[10px] text-slate-400">
                {t('receiptPaymentDueDate')}: {order.paymentDueAt}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <p className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{totalLabel}</p>
            <p className="text-[10px] text-slate-400">{t('receiptOpenDetails')}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrint();
          }}
          className="shrink-0 border-s border-slate-100 px-3 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          {t('printReceipt')}
        </button>
      </div>
    </div>
  );
};

const ReceiptDetailModal: React.FC<{
  order: ApiOrder;
  payHistory: ApiOrderPayment[];
  payHistoryLoading: boolean;
  onClose: () => void;
  onRefreshHistory: () => void;
  onRefetchOrders: () => void;
  canEditPayment: boolean;
  addOrderPayment: ReturnType<typeof useOrders>['addOrderPayment'];
  updateReceiptMeta: ReturnType<typeof useOrders>['updateReceiptMeta'];
}> = ({
  order,
  payHistory,
  payHistoryLoading,
  onClose,
  onRefreshHistory,
  onRefetchOrders,
  canEditPayment,
  addOrderPayment,
  updateReceiptMeta,
}) => {
  const { t } = useApp();
  const [buyerName, setBuyerName] = useState(order.customerReference ?? '');
  const [addAmt, setAddAmt] = useState('');
  const [addPaidAt, setAddPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [addNote, setAddNote] = useState('');
  const [savingBuyer, setSavingBuyer] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    setBuyerName(order.customerReference ?? '');
  }, [order.id, order.customerReference, order.updatedAt]);

  const totalLabel = order.totalAmount != null ? formatIls(order.totalAmount) : '—';
  const categories = useMemo(() => uniqueCategories(order.items), [order.items]);
  const pricedLines = useMemo(
    () =>
      order.items
        .map((it, i) => ({ it, i, line: it.lineTotal }))
        .filter((x) => x.line != null && Number.isFinite(x.line)),
    [order.items],
  );

  const saveBuyer = async () => {
    setSavingBuyer(true);
    setFormErr(null);
    try {
      const next = await updateReceiptMeta(order.id, { customer_reference: buyerName.trim() || null });
      if (next) onRefetchOrders();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingBuyer(false);
    }
  };

  const submitAddPayment = async () => {
    if (order.totalAmount == null) return;
    const parsed = parseFloat(addAmt.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormErr(t('receiptPaymentInvalidAmount'));
      return;
    }
    setSavingPay(true);
    setFormErr(null);
    try {
      const paidIso = new Date(addPaidAt).toISOString();
      const updated = await addOrderPayment(order.id, {
        amount: Math.round(parsed * 100) / 100,
        paid_at: paidIso,
        note: addNote.trim() || null,
      });
      if (updated) onRefetchOrders();
      setAddAmt('');
      onRefreshHistory();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingPay(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {order.receiptNumber ?? t('receiptDetailModalTitle')}
            </h2>
            {order.paymentStatus && (
              <span className={`mt-2 inline-block rounded-full px-2 py-px text-[10px] font-bold ${paymentBadgeClass(order.paymentStatus)}`}>
                {order.paymentStatus === 'paid'
                  ? t('receiptStatusPaid')
                  : order.paymentStatus === 'partial'
                    ? t('receiptStatusPartial')
                    : order.paymentStatus === 'unpaid'
                      ? t('receiptStatusUnpaid')
                      : order.paymentStatus}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <p className="text-slate-500">{t('receiptOrderId')}</p>
              <p className="font-mono text-slate-800 dark:text-slate-100">{order.id}</p>
            </div>
            <div>
              <p className="text-slate-500">{t('receiptCreatedBy')}</p>
              <p>{order.creatorName ?? '—'}</p>
            </div>
          </div>

          {canEditPayment && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t('receiptBuyerName')}</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={t('receiptBuyerNamePlaceholder')}
                />
                <button
                  type="button"
                  disabled={savingBuyer}
                  onClick={() => void saveBuyer()}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
                >
                  {savingBuyer ? '…' : t('saveChanges')}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
            <span className="font-medium">{t('salesReceiptTotal')}</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalLabel}</span>
          </div>
          {order.amountPaid != null && (
            <div className="flex justify-between text-sm">
              <span>{t('receiptAmountPaid')}</span>
              <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{formatIls(order.amountPaid)}</span>
            </div>
          )}
          {order.balanceDue != null && (
            <div className="flex justify-between text-sm">
              <span>{t('receiptBalanceDue')}</span>
              <span className="text-orange-600 dark:text-orange-300 tabular-nums">{formatIls(order.balanceDue)}</span>
            </div>
          )}

          {canEditPayment && (order.balanceDue ?? 0) > 0.009 && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">{t('receiptAddPayment')}</p>
              <label className="mt-2 block text-[11px] text-slate-600">{t('receiptAddPaymentAmount')}</label>
              <input
                value={addAmt}
                onChange={(e) => setAddAmt(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                inputMode="decimal"
              />
              <label className="mt-2 block text-[11px] text-slate-600">{t('receiptPaymentDateTime')}</label>
              <input
                type="datetime-local"
                value={addPaidAt}
                onChange={(e) => setAddPaidAt(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <label className="mt-2 block text-[11px] text-slate-600">{t('salesPaymentScheduleNotes')}</label>
              <textarea
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                rows={2}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              {formErr && <p className="mt-2 text-xs text-red-600">{formErr}</p>}
              <button
                type="button"
                disabled={savingPay}
                onClick={() => void submitAddPayment()}
                className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {savingPay ? '…' : t('receiptAddPaymentSubmit')}
              </button>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('receiptPaymentHistory')}</h3>
            {payHistoryLoading ? (
              <p className="text-sm text-slate-500">{t('loading')}</p>
            ) : payHistory.length === 0 ? (
              <p className="text-sm text-slate-500">{t('receiptNoPayments')}</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
                {payHistory.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 rounded border border-slate-100 px-2 py-1.5 dark:border-slate-600">
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">+{formatIls(p.amount)}</p>
                      <p className="text-slate-500">
                        {new Date(p.paidAt).toLocaleString()} · {p.recordedByName ?? '—'}
                      </p>
                      {p.note && <p className="text-slate-500">{p.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {categories.length > 0 && (
            <p className="text-xs text-slate-600">
              <span className="font-semibold">{t('receiptCategoriesLabel')}: </span>
              {categories.join(' · ')}
            </p>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-500">{t('orderItems')}</h3>
            <ul className="space-y-2">
              {order.items.map((it) => (
                <li key={it.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                  {it.profileName} · {it.colorName} · {it.quantity} {t('unitsShort')}
                  {it.lineTotal != null && <span className="float-end font-medium tabular-nums">{formatIls(it.lineTotal)}</span>}
                </li>
              ))}
            </ul>
          </div>

          {pricedLines.length > 1 && order.totalAmount != null && (
            <p className="text-xs text-indigo-800 dark:text-indigo-200">
              {t('orderPriceCalculation')}: {formatIls(order.totalAmount)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
};
