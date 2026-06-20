import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { ordersApi, type ApiOrder, type ApiOrderPayment } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { RecordPaymentModal } from './modals/RecordPaymentModal';
import { PaymentReceiptPreview } from './modals/PaymentReceiptPreview';

type Row = {
  paymentId: string;
  receiptNo: string;
  orderNo: string;
  customer: string;
  amount: number;
  paidAt: string;
  method: string;
  remainingAfter: number;
  orderId: string;
};

/**
 * Payments tab — historic register of every payment Finance has recorded
 * (positive entries) plus any refunds (negative entries from cancellations).
 * One row per OrderPayment, ordered most-recent first.
 */
export const FinancePaymentsTab: React.FC = () => {
  const { t, token } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  // Receipt-to-print: the order + the specific payment for that row. Fetched on
  // demand when a row's print button is clicked, then rendered as a clean,
  // print-isolated voucher (PaymentReceiptPreview) instead of printing the page.
  const [receipt, setReceipt] = useState<{ order: ApiOrder; payment: ApiOrderPayment } | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const orders = await ordersApi.list(token, { receipts_only: true });
      // For each order, walk through its payment history and accumulate
      // running paid so we can report "remaining after this payment".
      const aggregated: Row[] = [];
      for (const o of orders) {
        try {
          const pays = await ordersApi.listPayments(o.id, token);
          const total = o.totalAmount ?? 0;
          let running = 0;
          for (const p of pays) {
            running += Number(p.amount);
            const remaining = Math.max(0, total - running);
            const methodTag = (p.note ?? '').split('—')[0]?.trim() || '—';
            aggregated.push({
              paymentId: p.id,
              receiptNo: `PAY-${String(p.id).padStart(4, '0')}`,
              orderNo: o.receiptNumber ?? `ORD-${o.id}`,
              customer: o.clientName ?? o.taskCustomerName ?? o.customerReference ?? '—',
              amount: Number(p.amount),
              paidAt: p.paidAt,
              method: methodTag,
              remainingAfter: remaining,
              orderId: o.id,
            });
          }
        } catch {
          /* skip orders we can't read */
        }
      }
      aggregated.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      setRows(aggregated);
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
    if (!q) return rows;
    return rows.filter((r) =>
      [r.receiptNo, r.orderNo, r.customer, r.method].join(' ').toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Open the print-ready voucher for a single payment row. We fetch the live
  // order (for totals / customer / balance) and the matching payment, then hand
  // them to PaymentReceiptPreview which isolates itself for printing.
  const handlePrint = useCallback(
    async (row: Row) => {
      if (!token) return;
      setPrintingId(row.paymentId);
      setError(null);
      try {
        const [order, payments] = await Promise.all([
          ordersApi.show(row.orderId, token),
          ordersApi.listPayments(row.orderId, token),
        ]);
        const payment = payments.find((p) => String(p.id) === String(row.paymentId));
        if (!payment) {
          setError(t('fin.payments.printNotFound'));
          return;
        }
        setReceipt({ order, payment });
      } catch (e) {
        setError(e instanceof Error ? e.message : t('fin.payments.printError'));
      } finally {
        setPrintingId(null);
      }
    },
    [token, t],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.payments.title')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('fin.payments.searchPlaceholder')}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowRecord(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              + {t('fin.payments.recordNew')}
            </button>
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
          <p className="py-8 text-center text-sm text-slate-500">{t('fin.payments.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  <th className="pb-2 text-start">{t('fin.payments.colReceipt')}</th>
                  <th className="pb-2 text-start">{t('fin.overview.colCustomer')}</th>
                  <th className="pb-2 text-start">{t('fin.payments.colOrder')}</th>
                  <th className="pb-2 text-end">{t('fin.payments.colAmount')}</th>
                  <th className="pb-2 text-start">{t('fin.orders.colDate')}</th>
                  <th className="pb-2 text-start">{t('fin.orders.colMethod')}</th>
                  <th className="pb-2 text-end">{t('fin.payments.colRemainingAfter')}</th>
                  <th className="pb-2 text-end">{t('fin.orders.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((r) => {
                  const isRefund = r.amount < 0;
                  return (
                    <tr key={r.paymentId} className="text-slate-700 dark:text-slate-300">
                      <td className="py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">{r.receiptNo}</td>
                      <td className="py-3">{r.customer}</td>
                      <td className="py-3 font-mono text-xs">{r.orderNo}</td>
                      <td className={`py-3 text-end tabular-nums font-semibold ${isRefund ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isRefund ? '−' : '+'}{formatIls(Math.abs(r.amount))}
                      </td>
                      <td className="py-3 text-xs text-slate-500">{new Date(r.paidAt).toISOString().slice(0, 10)}</td>
                      <td className="py-3 text-xs text-slate-500">{r.method}</td>
                      <td className="py-3 text-end tabular-nums text-rose-600 dark:text-rose-400">{formatIls(r.remainingAfter)}</td>
                      <td className="py-3 text-end">
                        <button
                          type="button"
                          title={t('fin.payments.printAction')}
                          onClick={() => void handlePrint(r)}
                          disabled={printingId === r.paymentId}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {printingId === r.paymentId ? '…' : `🖨 ${t('fin.payments.printAction')}`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRecord && (
        <RecordPaymentModal
          onClose={() => setShowRecord(false)}
          onSuccess={() => {
            setShowRecord(false);
            void load();
          }}
        />
      )}

      {receipt && (
        <PaymentReceiptPreview
          order={receipt.order}
          payment={receipt.payment}
          onPrint={() => setReceipt(null)}
          onSkip={() => setReceipt(null)}
        />
      )}
    </div>
  );
};
