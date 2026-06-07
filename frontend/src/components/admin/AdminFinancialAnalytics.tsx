import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import type { ApiOrder } from '../../services/api';
import { ordersApi } from '../../services/api';
import { formatIls } from '../../utils/currency';
import { DistributionBar, MiniStat } from './AdminAnalytics';
import { AnalyticsDateFilter, type AnalyticsRange } from './AnalyticsDateFilter';

const RECENT_RECEIPTS = 25;

function customerLabel(o: ApiOrder): string {
  return o.clientName?.trim() || o.taskCustomerName?.trim() || o.customerReference?.trim() || '—';
}

export const AdminFinancialAnalytics: React.FC = () => {
  const { t, token, lang } = useApp();
  const isAr = lang === 'ar';
  const [range, setRange] = useState<AnalyticsRange>(null);
  const { data, loading, error, refresh } = useAdminAnalytics(range);
  const [recentReceipts, setRecentReceipts] = useState<ApiOrder[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const loadReceipts = useCallback(async () => {
    if (!token) {
      setRecentReceipts([]);
      return;
    }
    setReceiptsLoading(true);
    try {
      const rows = await ordersApi.list(token, { receipts_only: true });
      let scoped = rows;
      if (range) {
        const fromMs = new Date(`${range.from}T00:00:00`).getTime();
        const toMs = new Date(`${range.to}T23:59:59`).getTime();
        scoped = rows.filter((o) => {
          const ts = new Date(o.updatedAt).getTime();
          return ts >= fromMs && ts <= toMs;
        });
      }
      const sorted = [...scoped].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setRecentReceipts(sorted.slice(0, RECENT_RECEIPTS));
    } catch {
      setRecentReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts, data?.financial?.receiptsAnalyzedAt]);

  const f = data?.financial;

  const paymentSegments = useMemo(() => {
    if (!f) return [];
    const ps = f.byPaymentStatus;
    return [
      { key: 'paid', value: ps.paid ?? 0, className: 'bg-emerald-500 dark:bg-emerald-400', label: t('receiptStatusPaid') },
      { key: 'partial', value: ps.partial ?? 0, className: 'bg-amber-400 dark:bg-amber-500', label: t('receiptStatusPartial') },
      { key: 'unpaid', value: ps.unpaid ?? 0, className: 'bg-rose-500 dark:bg-rose-400', label: t('receiptStatusUnpaid') },
      { key: 'unknown', value: ps.unknown ?? 0, className: 'bg-slate-400 dark:bg-slate-500', label: t('adminFinancialUnknownStatus') },
    ];
  }, [f, t]);

  const collectionPct = useMemo(() => {
    if (!f || f.totalBilledAllTime < 0.01) return null;
    return Math.min(100, Math.round((f.totalPaidAllTime / f.totalBilledAllTime) * 1000) / 10);
  }, [f]);

  const overdueSharePct = useMemo(() => {
    if (!f || f.totalOutstandingAllTime < 0.01) return null;
    return Math.round((f.overdueOutstanding / f.totalOutstandingAllTime) * 1000) / 10;
  }, [f]);

  const avgBilledPerReceipt = useMemo(() => {
    if (!f || f.completedReceiptsCount < 1) return null;
    return Math.round((f.totalBilledAllTime / f.completedReceiptsCount) * 100) / 100;
  }, [f]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!f) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        {t('adminFinancialUnavailable')}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('adminFinancialDashboardTitle')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('adminSectionFinancialDesc')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {t('adminAnalyticsLastUpdated')}: {new Date(f.receiptsAnalyzedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void refresh();
              void loadReceipts();
            }}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {loading ? '…' : t('adminAnalyticsRefresh')}
          </button>
        </div>
      </div>

      <AnalyticsDateFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MiniStat
          label={t('adminFinancialReceipts')}
          value={f.completedReceiptsCount}
          hint={`${t('adminFinancialBilled')}: ${formatIls(f.totalBilledAllTime)}`}
          accent="text-sky-600 dark:text-sky-400"
        />
        <MiniStat
          label={t('adminFinancialPaid')}
          value={formatIls(f.totalPaidAllTime)}
          hint={t('adminFinancialRevenueCollected')}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <MiniStat
          label={t('adminFinancialOutstanding')}
          value={formatIls(f.totalOutstandingAllTime)}
          hint={`${f.overdueReceiptsCount} ${t('adminFinancialOverdueCount').toLowerCase()}`}
          accent="text-amber-600 dark:text-amber-400"
        />
        <MiniStat
          label={t('adminFinancialCollectionRate')}
          value={collectionPct != null ? `${collectionPct}%` : '—'}
          hint={t('adminFinancialCollectionHint')}
          accent="text-violet-600 dark:text-violet-400"
        />
        <MiniStat
          label={t('adminFinancialBilledPerReceipt')}
          value={avgBilledPerReceipt != null ? formatIls(avgBilledPerReceipt) : '—'}
          hint={t('adminFinancialAvgReceiptHint')}
          accent="text-cyan-600 dark:text-cyan-400"
        />
        <MiniStat
          label={t('adminFinancialCustomersDebit')}
          value={f.customersWithOutstandingCount}
          hint={t('adminFinancialTopDebtors')}
          accent="text-rose-600 dark:text-rose-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminPaymentStatusMix')}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminPaymentStatusMixDesc')}</p>
          <div className="mt-4">
            <DistributionBar segments={paymentSegments} />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminFinancialRiskSnapshot')}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminFinancialRiskSnapshotDesc')}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">{t('paymentAnalyticsOverdue')}</dt>
              <dd className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatIls(f.overdueOutstanding)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">{t('adminFinancialOverdueShare')}</dt>
              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {overdueSharePct != null ? `${overdueSharePct}%` : '—'}{' '}
                <span className="text-xs font-normal text-slate-400">{t('adminFinancialOfOutstanding')}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t('adminFinancialNextMonthDue')}</dt>
              <dd className="text-end text-slate-800 dark:text-slate-200">
                <span className="font-semibold tabular-nums">{f.dueNextMonth.count}</span> {t('paymentBucketCount').toLowerCase()}
                <br />
                <span className="text-xs text-slate-500">{t('paymentBucketOutstanding')}: </span>
                <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {formatIls(f.dueNextMonth.totalOutstanding)}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminFinancialActivityWindows')}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminFinancialActivityWindowsDesc')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { label: t('adminFinancialToday'), b: f.today },
            { label: t('adminFinancialThisMonth'), b: f.thisMonth },
            { label: t('adminFinancialThisYear'), b: f.thisYear },
          ].map(({ label, b }) => (
            <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{b.count}</p>
              <p className="text-[11px] text-slate-500">{t('paymentBucketCount')}</p>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t('paymentBucketBilled')}</dt>
                  <dd className="font-semibold tabular-nums">{formatIls(b.totalBilled)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t('paymentBucketPaid')}</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatIls(b.totalPaid)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t('paymentBucketOutstanding')}</dt>
                  <dd className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatIls(b.totalOutstanding)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminFinancialTopDebtors')}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminFinancialTopDebtorsDesc')}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 pr-3">{t('receiptTaskCustomer')}</th>
                <th className="pb-2 pr-3">{t('paymentBucketCount')}</th>
                <th className="pb-2">{t('paymentBucketOutstanding')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {f.topOutstandingCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400 dark:text-slate-500">
                    {t('paymentAnalyticsNoOutstanding')}
                  </td>
                </tr>
              ) : (
                f.topOutstandingCustomers.map((row) => (
                  <tr key={row.customerLabel} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.customerLabel}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.receiptCount}</td>
                    <td className="py-2.5 font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatIls(row.outstanding)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminFinancialRecentReceipts')}</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('adminFinancialRecentReceiptsDesc')}</p>
          </div>
          {receiptsLoading && <span className="text-xs text-slate-400">{t('loading')}</span>}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 pr-3">{t('receiptReceiptNo')}</th>
                <th className="pb-2 pr-3">{t('receiptTaskCustomer')}</th>
                <th className="pb-2 pr-3">{t('salesReceiptTotal')}</th>
                <th className="pb-2 pr-3">{t('receiptAmountPaid')}</th>
                <th className="pb-2 pr-3">{t('receiptBalanceDue')}</th>
                <th className="pb-2 pr-3">{t('receiptPaymentDueDate')}</th>
                <th className="pb-2">{t('salesReceiptPaymentStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 dark:text-slate-500">
                    {t('salesNoReceiptsYet')}
                  </td>
                </tr>
              ) : (
                recentReceipts.map((o) => {
                  const isCancelled = Boolean(o.cancellationType || o.status === 'cancelled');
                  const statusLabel =
                    o.cancellationType === 'full' || o.status === 'cancelled'
                      ? (isAr ? 'ملغي كامل' : 'Fully cancelled')
                      : o.cancellationType === 'partial'
                        ? (isAr ? 'ملغي جزئياً' : 'Partially cancelled')
                        : o.paymentStatus === 'paid'
                          ? t('receiptStatusPaid')
                          : o.paymentStatus === 'partial'
                            ? t('receiptStatusPartial')
                            : o.paymentStatus === 'unpaid'
                              ? t('receiptStatusUnpaid')
                              : (o.paymentStatus ?? 'â€”');

                  return (
                  <tr key={o.id} className={`${isCancelled ? 'bg-rose-50/70 text-rose-900 dark:bg-rose-950/20 dark:text-rose-100' : 'text-slate-700 dark:text-slate-300'}`}>
                    <td className="py-2 pr-3 font-mono text-xs">{o.receiptNumber ?? o.id.slice(0, 8)}</td>
                    <td className="py-2 pr-3">{customerLabel(o)}</td>
                    <td className="py-2 pr-3 tabular-nums">{o.totalAmount != null ? formatIls(o.totalAmount) : '—'}</td>
                    <td className="py-2 pr-3 tabular-nums text-emerald-700 dark:text-emerald-400">
                      {o.amountPaid != null ? formatIls(o.amountPaid) : '—'}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-amber-700 dark:text-amber-400">
                      {o.balanceDue != null ? formatIls(o.balanceDue) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs">{o.paymentDueAt ?? '—'}</td>
                    <td className="py-2 text-xs font-medium hidden">
                      {o.paymentStatus === 'paid'
                        ? t('receiptStatusPaid')
                        : o.paymentStatus === 'partial'
                          ? t('receiptStatusPartial')
                          : o.paymentStatus === 'unpaid'
                            ? t('receiptStatusUnpaid')
                            : (o.paymentStatus ?? '—')}
                    </td>
                    <td className="py-2 text-xs font-medium">{statusLabel}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
