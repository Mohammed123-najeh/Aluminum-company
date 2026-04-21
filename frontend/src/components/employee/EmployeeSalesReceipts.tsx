import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useOrders } from '../../hooks/useOrders';
import type { ApiOrder, ApiOrderItem } from '../../services/api';
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
  if (status === 'partial') return 'bg-amber-500/15 text-amber-900 dark:text-amber-200';
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
      const parts = [it.profileName, it.colorName, `${it.quantityM} m`].filter(Boolean).join(' · ');
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
  const { orders, loading, error, refetch, updatePayment } = useOrders();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dueFilter, setDueFilter] = useState<string>('');
  const [groupByCustomer, setGroupByCustomer] = useState(false);

  const canEditPayment = currentUser?.role === 'supervisor' || currentUser?.role === 'admin';

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
                expanded={expandedId === o.id}
                onToggle={() => setExpandedId((id) => (id === o.id ? null : o.id))}
                onPrint={() => openPrint(o)}
                canEditPayment={canEditPayment}
                onPaymentSaved={() => void refetch()}
                updatePayment={updatePayment}
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
    </div>
  );
};

const ReceiptRow: React.FC<{
  order: ApiOrder;
  expanded: boolean;
  onToggle: () => void;
  onPrint: () => void;
  canEditPayment: boolean;
  onPaymentSaved: () => void;
  updatePayment: ReturnType<typeof useOrders>['updatePayment'];
}> = ({ order, expanded, onToggle, onPrint, canEditPayment, onPaymentSaved, updatePayment }) => {
  const { t } = useApp();
  const [payAmount, setPayAmount] = useState('');
  const [payDue, setPayDue] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  useEffect(() => {
    if (expanded) {
      setPayAmount(order.amountPaid != null ? String(order.amountPaid) : '0');
      setPayDue(order.paymentDueAt ?? '');
      setPayNotes(order.paymentNotes ?? '');
      setPayErr(null);
    }
  }, [expanded, order.amountPaid, order.paymentDueAt, order.paymentNotes, order.id, order.updatedAt]);

  const totalLabel = order.totalAmount != null ? formatIls(order.totalAmount) : '—';
  const categories = useMemo(() => uniqueCategories(order.items), [order.items]);
  const pricedLines = useMemo(
    () =>
      order.items
        .map((it, i) => ({ it, i, line: it.lineTotal }))
        .filter((x) => x.line != null && Number.isFinite(x.line)),
    [order.items],
  );
  const sumFromLines = useMemo(
    () => pricedLines.reduce((s, x) => s + (x.line as number), 0),
    [pricedLines],
  );

  const statusBadge =
    order.paymentStatus === 'paid'
      ? t('receiptStatusPaid')
      : order.paymentStatus === 'partial'
        ? t('receiptStatusPartial')
        : order.paymentStatus === 'unpaid'
          ? t('receiptStatusUnpaid')
          : (order.paymentStatus ?? '—');

  const savePayment = async () => {
    if (!canEditPayment || order.totalAmount == null) return;
    const parsed = parseFloat(payAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setPayErr(t('receiptPaymentInvalidAmount'));
      return;
    }
    const max = order.totalAmount;
    if (parsed > max + 0.001) {
      setPayErr(t('salesPaymentExceedsTotal'));
      return;
    }
    setPaySaving(true);
    setPayErr(null);
    try {
      await updatePayment(order.id, {
        amount_paid: Math.round(parsed * 100) / 100,
        payment_due_at: payDue.trim() || null,
        payment_notes: payNotes.trim() || null,
      });
      onPaymentSaved();
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setPaySaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={onToggle}
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
            <p className="text-[10px] text-slate-400">{expanded ? '▲' : '▼'}</p>
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
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-700">
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptOrderId')}</dt>
              <dd className="font-mono text-slate-700 dark:text-slate-200">{order.id}</dd>
            </div>
            {order.receiptNumber && (
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptReceiptNo')}</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{order.receiptNumber}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptCreatedBy')}</dt>
              <dd className="text-slate-700 dark:text-slate-200">{order.creatorName ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptTaskCustomer')}</dt>
              <dd className="text-slate-700 dark:text-slate-200">{customerDisplayName(order)}</dd>
            </div>
            {order.clientName && (
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptClientName')}</dt>
                <dd className="text-slate-700 dark:text-slate-200">
                  {order.clientName}
                  {order.clientPhone ? ` · ${order.clientPhone}` : ''}
                </dd>
              </div>
            )}
            {order.taskTitle && (
              <div className="sm:col-span-2">
                <dt className="font-medium text-slate-500 dark:text-slate-400">{t('linkedTask')}</dt>
                <dd className="text-slate-700 dark:text-slate-200">{order.taskTitle}</dd>
              </div>
            )}
            {order.amountPaid != null && (
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptAmountPaid')}</dt>
                <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatIls(order.amountPaid)}</dd>
              </div>
            )}
            {order.balanceDue != null && (
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptBalanceDue')}</dt>
                <dd className="tabular-nums text-amber-700 dark:text-amber-400">{formatIls(order.balanceDue)}</dd>
              </div>
            )}
            {order.paymentDueAt && (
              <div>
                <dt className="font-medium text-slate-500 dark:text-slate-400">{t('receiptPaymentDueDate')}</dt>
                <dd className="text-slate-700 dark:text-slate-200">{order.paymentDueAt}</dd>
              </div>
            )}
          </dl>

          {order.paymentNotes && (
            <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
              {order.paymentNotes}
            </p>
          )}

          {canEditPayment && order.status === 'completed' && (
            <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/25">
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">{t('receiptPaymentEditHint')}</p>
              <label className="mt-2 block text-[11px] text-slate-600 dark:text-slate-400">{t('receiptAmountPaid')}</label>
              <input
                type="text"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <label className="mt-2 block text-[11px] text-slate-600 dark:text-slate-400">{t('receiptPaymentDueDate')}</label>
              <input
                type="date"
                value={payDue}
                onChange={(e) => setPayDue(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <label className="mt-2 block text-[11px] text-slate-600 dark:text-slate-400">{t('salesPaymentScheduleNotes')}</label>
              <textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                rows={2}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              {payErr && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{payErr}</p>}
              <button
                type="button"
                disabled={paySaving}
                onClick={() => void savePayment()}
                className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {paySaving ? t('receiptPaymentUpdating') : t('receiptSavePayment')}
              </button>
            </div>
          )}

          {order.customerReference && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('customerReference')}: {order.customerReference}
            </p>
          )}

          {categories.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-400">{t('receiptCategoriesLabel')}</p>
              <p className="text-sm text-slate-800 dark:text-slate-200">{categories.join(' · ')}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">{t('orderItems')}</p>
            <ul className="space-y-2">
              {order.items.map((it) => (
                <li
                  key={it.id}
                  className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex justify-between gap-2 text-slate-700 dark:text-slate-300">
                    <span className="min-w-0">
                      {it.categoryName && <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{it.categoryName} · </span>}
                      {it.profileName} · {it.colorName} · {it.quantityM} m
                    </span>
                    {it.lineTotal != null && <span className="shrink-0 tabular-nums font-medium">{formatIls(it.lineTotal)}</span>}
                  </div>
                  {it.unitPricePerM != null && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('salesPricePerM')}: {formatIls(it.unitPricePerM)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {pricedLines.length > 1 && (
            <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-3 py-2 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <p className="mb-1 text-xs font-semibold text-indigo-900 dark:text-indigo-200">{t('orderPriceCalculation')}</p>
              <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-200">
                {pricedLines.map((x, j) => (
                  <li key={x.it.id} className="flex flex-wrap items-center gap-1">
                    {j > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-400">+</span>}
                    <span className="tabular-nums">{formatIls(x.line as number)}</span>
                    <span className="text-xs text-slate-500">
                      ({x.it.profileName}/{x.it.colorName})
                    </span>
                  </li>
                ))}
              </ul>
              {Math.abs(sumFromLines - (order.totalAmount ?? 0)) < 0.02 && order.totalAmount != null && (
                <p className="mt-2 border-t border-indigo-200/60 pt-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                  = {formatIls(order.totalAmount)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{t('salesReceiptTotal')}</span>
            <span className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{totalLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};
