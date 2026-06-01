import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, ordersApi, type ApiFinanceDashboard, type ApiOrder } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { KpiCard, StatusBadge } from '../../shared/dash';

/**
 * Overview tab — 7-tile financial KPI grid + recent-orders table.
 * Layout matches the screenshot: 4 KPIs per row, the 4th row position empty
 * to give the "Unpaid orders" tile breathing room.
 */
type Props = {
  /** Called when the user clicks "View all" on the recent-orders block. */
  onViewAllOrders?: () => void;
};

export const FinanceOverviewTab: React.FC<Props> = ({ onViewAllOrders }) => {
  const { token, t } = useApp();
  const [data, setData] = useState<ApiFinanceDashboard | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [d, o] = await Promise.all([
        financeCenterApi.dashboard(token),
        ordersApi.list(token, { receipts_only: true }),
      ]);
      setData(d);
      // Most recently updated first.
      const sorted = [...o].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setOrders(sorted.slice(0, 5));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>;
  if (!data) return null;

  const k = data.kpi;

  const orderRows = orders.map((o) => {
    const total = o.totalAmount ?? 0;
    const paid = o.amountPaid ?? 0;
    const remaining = Math.max(0, total - paid);
    const statusTone: 'green' | 'amber' | 'rose' | 'slate' =
      o.paymentStatus === 'paid' ? 'green'
      : o.paymentStatus === 'partial' ? 'amber'
      : o.paymentStatus === 'unpaid' ? 'rose'
      : 'slate';
    const statusLabel =
      o.paymentStatus === 'paid' ? t('fin.overview.statusPaid')
      : o.paymentStatus === 'partial' ? t('fin.overview.statusPartial')
      : o.paymentStatus === 'unpaid' ? t('fin.overview.statusUnpaid')
      : t('fin.overview.statusUnknown');
    return {
      id: o.id,
      number: o.receiptNumber ?? `ORD-${o.id}`,
      customer: o.clientName ?? o.taskCustomerName ?? o.customerReference ?? '—',
      total,
      paid,
      remaining,
      statusTone,
      statusLabel,
    };
  });

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('admin.fin.revenueToday')}
          value={`${formatIls(k.revenueToday.value)}`}
          tone="positive"
          delta={k.revenueToday}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" /></svg>}
        />
        <KpiCard
          label={t('admin.fin.revenueMonth')}
          value={`${formatIls(k.revenue.value)}`}
          tone="accent"
          delta={k.revenue}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
        />
        <KpiCard
          label={t('admin.fin.expenseToday')}
          value={`${formatIls(k.expensesToday.value)}`}
          tone="danger"
          delta={k.expensesToday}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8M14 17h7v-7" /></svg>}
        />
        <KpiCard
          label={t('admin.fin.expenseMonth')}
          value={`${formatIls(k.expenses.value)}`}
          tone="danger"
          delta={k.expenses}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8M14 17h7v-7" /></svg>}
        />

        <KpiCard
          label={t('admin.fin.netToday')}
          value={`${formatIls(k.netToday.value)}`}
          tone="positive"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h5" /></svg>}
        />
        <KpiCard
          label={t('admin.fin.netMonth')}
          value={`${formatIls(k.net.value)}`}
          tone="accent"
          delta={k.net}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h5" /></svg>}
        />
        <KpiCard
          label={t('admin.fin.unpaidOrders')}
          value={`${k.incompletePaymentCount} ${t('admin.fin.unit.order')}`}
          tone="warning"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 16h.01" /></svg>}
        />
      </div>

      {/* Recent orders */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.overview.recentTitle')}</h3>
          {onViewAllOrders && (
            <button
              type="button"
              onClick={onViewAllOrders}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('fin.overview.viewAll')}
            </button>
          )}
        </div>

        {orderRows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('fin.overview.empty')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  <th className="pb-2 text-start">{t('fin.overview.colOrderNo')}</th>
                  <th className="pb-2 text-start">{t('fin.overview.colCustomer')}</th>
                  <th className="pb-2 text-end">{t('fin.overview.colTotal')}</th>
                  <th className="pb-2 text-end">{t('fin.overview.colPaid')}</th>
                  <th className="pb-2 text-end">{t('fin.overview.colRemaining')}</th>
                  <th className="pb-2 text-start">{t('fin.overview.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {orderRows.map((r) => (
                  <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                    <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{r.number}</td>
                    <td className="py-3">{r.customer}</td>
                    <td className="py-3 text-end tabular-nums">{formatIls(r.total)}</td>
                    <td className="py-3 text-end tabular-nums text-emerald-600 dark:text-emerald-400">{formatIls(r.paid)}</td>
                    <td className="py-3 text-end tabular-nums text-rose-600 dark:text-rose-400">{formatIls(r.remaining)}</td>
                    <td className="py-3">
                      <StatusBadge status={r.statusLabel} tone={r.statusTone} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
