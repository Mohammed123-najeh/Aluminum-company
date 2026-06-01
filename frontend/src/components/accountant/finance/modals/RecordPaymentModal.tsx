import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { ordersApi, type ApiOrder } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';

/**
 * Header action — "Record payment". Open from anywhere in Finance Center.
 * Lists every completed order with a remaining balance, lets Finance pick
 * one, enter the amount + method + date, and posts to /orders/:id/payments
 * (the same endpoint the receipt-detail screen uses).
 */
export const RecordPaymentModal: React.FC<{
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ onClose, onSuccess }) => {
  const { t, token } = useApp();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState<'cash' | 'transfer' | 'check' | 'card'>('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    ordersApi
      .list(token, { receipts_only: true })
      .then((rows) => {
        // Only orders with a remaining balance need a payment recorded.
        const open = rows.filter((o) => (o.balanceDue ?? 0) > 0.009);
        // Most recently touched first — finance usually wants the latest sale.
        open.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setOrders(open);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const haystack = [
        o.id,
        o.clientName,
        o.taskCustomerName,
        o.customerReference,
        o.receiptNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search]);

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const balance = selected?.balanceDue ?? 0;
  const amountNum = amount.trim() ? Number(amount) : NaN;
  const overpay = Number.isFinite(amountNum) && amountNum > balance + 0.009;
  const valid = selected && Number.isFinite(amountNum) && amountNum > 0 && !overpay;

  const submit = async () => {
    if (!token || !selected || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await ordersApi.addPayment(selected.id, token, {
        amount: amountNum,
        paid_at: new Date(paidAt).toISOString(),
        note: note.trim() || `via Finance — ${method}`,
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fin.record.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => !submitting && onClose()} aria-hidden />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <h2 className="text-base font-bold">{t('fin.record.title')}</h2>
          <p className="mt-0.5 text-xs text-white/80">{t('fin.record.subtitle')}</p>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {/* Left: order picker */}
          <div className="space-y-3">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('fin.record.searchPlaceholder')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {loading ? (
                <p className="p-4 text-center text-xs text-slate-500">{t('fin.common.loading')}</p>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">{t('fin.record.noOpenOrders')}</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filtered.map((o) => {
                    const active = selectedId === o.id;
                    const label = o.clientName || o.taskCustomerName || o.customerReference || `#${o.id}`;
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(o.id)}
                          className={`w-full px-3 py-2.5 text-start transition ${
                            active
                              ? 'bg-indigo-50 dark:bg-indigo-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {label}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-rose-600 dark:text-rose-300">
                              {formatIls(o.balanceDue ?? 0)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            #{o.id} · {t('fin.record.totalLabel')} {formatIls(o.totalAmount ?? 0)} · {t('fin.record.paidLabel')} {formatIls(o.amountPaid ?? 0)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: payment form */}
          <div className="space-y-3">
            {!selected ? (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-600">
                {t('fin.record.pickOrderHint')}
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {selected.clientName || selected.taskCustomerName || selected.customerReference || `#${selected.id}`}
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    {t('fin.record.balanceLabel')}: <span className="font-bold text-rose-600 dark:text-rose-300">{formatIls(balance)}</span>
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('fin.record.amountLabel')}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
                      overpay
                        ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
                        : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 dark:border-slate-600'
                    }`}
                    placeholder={balance.toFixed(2)}
                    dir="ltr"
                  />
                  {overpay && (
                    <p className="mt-1 text-[11px] text-rose-600">{t('fin.record.overpayError')}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('fin.record.methodLabel')}
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="cash">{t('fin.method.cash')}</option>
                    <option value="transfer">{t('fin.method.transfer')}</option>
                    <option value="check">{t('fin.method.check')}</option>
                    <option value="card">{t('fin.method.card')}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('fin.record.dateLabel')}
                  </label>
                  <input
                    type="datetime-local"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('fin.record.noteLabel')}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder={t('fin.record.notePlaceholder')}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <p className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || submitting}
            className="rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
          >
            {submitting ? '…' : t('fin.record.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
