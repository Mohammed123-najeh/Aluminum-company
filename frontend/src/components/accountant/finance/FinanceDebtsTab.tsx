import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { ordersApi, type ApiOrder } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { StatusBadge } from '../../shared/dash';

/**
 * Debts tab — outstanding customer balances. Aggregates completed orders with
 * `balanceDue > 0`. Status = "late" when paymentDueAt has passed, "normal"
 * otherwise. Cancelled orders are already excluded server-side.
 */
export const FinanceDebtsTab: React.FC = () => {
  const { t, token } = useApp();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const all = await ordersApi.list(token, { receipts_only: true });
      const debts = all.filter((o) => (o.balanceDue ?? 0) > 0.009);
      // Late first, then by due date ascending.
      debts.sort((a, b) => {
        const ad = a.paymentDueAt ?? '9999-12-31';
        const bd = b.paymentDueAt ?? '9999-12-31';
        return ad.localeCompare(bd);
      });
      setOrders(debts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.debts.heading')}</h3>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('fin.common.loading')}</p>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('fin.debts.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 text-start">{t('fin.overview.colCustomer')}</th>
                <th className="pb-2 text-start">{t('fin.overview.colOrderNo')}</th>
                <th className="pb-2 text-end">{t('fin.debts.colRemaining')}</th>
                <th className="pb-2 text-start">{t('fin.debts.colDueDate')}</th>
                <th className="pb-2 text-start">{t('fin.debts.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {orders.map((o) => {
                const due = o.paymentDueAt ?? null;
                const isLate = due !== null && due < today;
                return (
                  <tr key={o.id} className="text-slate-700 dark:text-slate-300">
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">
                      {o.clientName ?? o.taskCustomerName ?? o.customerReference ?? '—'}
                    </td>
                    <td className="py-3 font-mono text-xs">{o.receiptNumber ?? `ORD-${o.id}`}</td>
                    <td className="py-3 text-end tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      {formatIls(o.balanceDue ?? 0)}
                    </td>
                    <td className="py-3 text-xs text-slate-500">{due ?? '—'}</td>
                    <td className="py-3">
                      {isLate ? (
                        <StatusBadge status="late" tone="amber" label={t('fin.debts.statusLate')} />
                      ) : (
                        <StatusBadge status="normal" tone="indigo" label={t('fin.debts.statusNormal')} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
