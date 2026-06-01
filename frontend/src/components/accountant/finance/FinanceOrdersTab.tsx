import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { ordersApi, type ApiOrder, type ApiOrderPayment } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { StatusBadge } from '../../shared/dash';
import { RecordPaymentModal } from './modals/RecordPaymentModal';

type PaymentFilter = 'all' | 'paid' | 'partial' | 'unpaid';

/**
 * Orders tab — full table of every completed receipt-bearing order with
 * payment status, balance, last payment date + method, and per-row actions
 * (View detail, Record payment). Filtered/searchable.
 */
export const FinanceOrdersTab: React.FC = () => {
  const { t, token } = useApp();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [lastPayments, setLastPayments] = useState<Record<string, ApiOrderPayment | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [recordTargetId, setRecordTargetId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<ApiOrder | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await ordersApi.list(token, { receipts_only: true });
      setOrders(rows);
      // Pull "last payment" for each order in parallel. Cheap because the
      // endpoint returns a small list per order; the Promise.all keeps it tidy.
      const entries = await Promise.all(
        rows.map(async (o) => {
          try {
            const pays = await ordersApi.listPayments(o.id, token);
            const last = pays.length > 0 ? pays[pays.length - 1] : null;
            return [o.id, last] as const;
          } catch {
            return [o.id, null] as const;
          }
        }),
      );
      setLastPayments(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.paymentStatus !== filter) return false;
      if (!q) return true;
      const hay = [o.id, o.clientName, o.taskCustomerName, o.customerReference, o.receiptNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, search, filter]);

  const onPaymentRecorded = () => {
    setRecordTargetId(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.orders.title')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('fin.orders.searchPlaceholder')}
                className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as PaymentFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('fin.orders.filterAll')}</option>
              <option value="paid">{t('fin.overview.statusPaid')}</option>
              <option value="partial">{t('fin.overview.statusPartial')}</option>
              <option value="unpaid">{t('fin.overview.statusUnpaid')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('fin.common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('fin.orders.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  <th className="pb-2 text-start">{t('fin.overview.colOrderNo')}</th>
                  <th className="pb-2 text-start">{t('fin.overview.colCustomer')}</th>
                  <th className="pb-2 text-start">{t('fin.orders.colDate')}</th>
                  <th className="pb-2 text-end">{t('fin.overview.colTotal')}</th>
                  <th className="pb-2 text-end">{t('fin.overview.colPaid')}</th>
                  <th className="pb-2 text-end">{t('fin.overview.colRemaining')}</th>
                  <th className="pb-2 text-start">{t('fin.overview.colStatus')}</th>
                  <th className="pb-2 text-start">{t('fin.orders.colLastPayment')}</th>
                  <th className="pb-2 text-start">{t('fin.orders.colMethod')}</th>
                  <th className="pb-2 text-end">{t('fin.orders.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((o) => {
                  const total = o.totalAmount ?? 0;
                  const paid = o.amountPaid ?? 0;
                  const remaining = Math.max(0, total - paid);
                  const tone: 'green' | 'amber' | 'rose' | 'slate' =
                    o.paymentStatus === 'paid' ? 'green'
                    : o.paymentStatus === 'partial' ? 'amber'
                    : o.paymentStatus === 'unpaid' ? 'rose'
                    : 'slate';
                  const label =
                    o.paymentStatus === 'paid' ? t('fin.overview.statusPaid')
                    : o.paymentStatus === 'partial' ? t('fin.overview.statusPartial')
                    : o.paymentStatus === 'unpaid' ? t('fin.overview.statusUnpaid')
                    : t('fin.overview.statusUnknown');
                  const last = lastPayments[o.id];
                  return (
                    <tr key={o.id} className="text-slate-700 dark:text-slate-300">
                      <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{o.receiptNumber ?? `ORD-${o.id}`}</td>
                      <td className="py-3">{o.clientName ?? o.taskCustomerName ?? o.customerReference ?? '—'}</td>
                      <td className="py-3 text-xs text-slate-500">{new Date(o.updatedAt).toISOString().slice(0, 10)}</td>
                      <td className="py-3 text-end tabular-nums">{formatIls(total)}</td>
                      <td className="py-3 text-end tabular-nums text-emerald-600 dark:text-emerald-400">{formatIls(paid)}</td>
                      <td className="py-3 text-end tabular-nums text-rose-600 dark:text-rose-400">{formatIls(remaining)}</td>
                      <td className="py-3"><StatusBadge status={label} tone={tone} /></td>
                      <td className="py-3 text-xs text-slate-500">{last ? new Date(last.paidAt).toISOString().slice(0, 10) : '—'}</td>
                      <td className="py-3 text-xs text-slate-500">{last?.note?.split('—')[0]?.trim() || '—'}</td>
                      <td className="py-3 text-end">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            title={t('fin.orders.viewAction')}
                            onClick={() => setDetailTarget(o)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          {remaining > 0.009 && (
                            <button
                              type="button"
                              title={t('fin.orders.recordAction')}
                              onClick={() => setRecordTargetId(o.id)}
                              className="rounded-md border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recordTargetId && (
        <RecordPaymentModal onClose={() => setRecordTargetId(null)} onSuccess={onPaymentRecorded} />
      )}

      {detailTarget && (
        <OrderDetailDrawer order={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
};

/**
 * Lightweight read-only detail drawer for an order — items, totals, and the
 * recent payment history. Opens from the eye icon. Kept inline to avoid
 * spawning another file for a one-page peek.
 */
const OrderDetailDrawer: React.FC<{ order: ApiOrder; onClose: () => void }> = ({ order, onClose }) => {
  const { t, token } = useApp();
  const [payments, setPayments] = useState<ApiOrderPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    ordersApi
      .listPayments(order.id, token)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [order.id, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <h2 className="text-base font-bold">{order.receiptNumber ?? `ORD-${order.id}`}</h2>
          <p className="mt-0.5 text-xs text-white/80">
            {order.clientName ?? order.taskCustomerName ?? order.customerReference ?? '—'}
          </p>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[10px] uppercase text-slate-500">{t('fin.overview.colTotal')}</p>
              <p className="mt-1 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatIls(order.totalAmount ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300">{t('fin.overview.colPaid')}</p>
              <p className="mt-1 font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatIls(order.amountPaid ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-950/40">
              <p className="text-[10px] uppercase text-rose-700 dark:text-rose-300">{t('fin.overview.colRemaining')}</p>
              <p className="mt-1 font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {formatIls(order.balanceDue ?? 0)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">{t('fin.orders.paymentHistory')}</h3>
            {loading ? (
              <p className="text-xs text-slate-500">{t('fin.common.loading')}</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-slate-500">{t('fin.orders.noPayments')}</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2 text-xs dark:border-slate-700"
                  >
                    <div>
                      <p className={`font-bold tabular-nums ${p.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {p.amount < 0 ? '−' : '+'}{formatIls(Math.abs(p.amount))}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {new Date(p.paidAt).toLocaleString()} · {p.recordedByName ?? '—'}
                      </p>
                    </div>
                    {p.note && <p className="max-w-[60%] truncate text-end text-slate-500">{p.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
