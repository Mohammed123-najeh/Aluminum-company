import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiReceiptPaymentAnalytics } from '../../services/api';
import { receiptPaymentAnalyticsApi } from '../../services/api';
import { formatIls } from '../../utils/currency';

function BucketCard({
  label,
  bucket,
}: {
  label: string;
  bucket: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
}) {
  const { t } = useApp();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{bucket.count}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('paymentBucketCount')}</p>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{t('paymentBucketBilled')}</dt>
          <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatIls(bucket.totalBilled)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{t('paymentBucketPaid')}</dt>
          <dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatIls(bucket.totalPaid)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{t('paymentBucketOutstanding')}</dt>
          <dd className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatIls(bucket.totalOutstanding)}</dd>
        </div>
      </dl>
    </div>
  );
}

export const SupervisorPaymentAnalytics: React.FC = () => {
  const { t, token } = useApp();
  const [data, setData] = useState<ApiReceiptPaymentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await receiptPaymentAnalyticsApi.get(token);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
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

  if (!data) return null;

  const ps = data.byPaymentStatus;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('paymentAnalyticsIntro')}</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {loading ? '…' : t('paymentAnalyticsRefresh')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BucketCard label={t('adminFinancialToday')} bucket={data.today} />
        <BucketCard label={t('adminFinancialThisMonth')} bucket={data.thisMonth} />
        <BucketCard label={t('adminFinancialThisYear')} bucket={data.thisYear} />
        <BucketCard label={t('paymentAnalyticsDueNextMonth')} bucket={data.dueNextMonth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('receiptFilterPaymentStatus')}</h3>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">{t('receiptStatusPaid')}</span>: {ps.paid ?? 0}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-amber-700 dark:text-amber-400">{t('receiptStatusPartial')}</span>: {ps.partial ?? 0}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-rose-700 dark:text-rose-400">{t('receiptStatusUnpaid')}</span>: {ps.unpaid ?? 0}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('paymentAnalyticsOverdue')}</h3>
          <p className="mt-2 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{data.overdueCount}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('paymentBucketOutstanding')}:{' '}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatIls(data.overdueOutstanding)}</span>
          </p>
          {data.customersWithOutstandingCount != null && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t('adminFinancialCustomersDebit')}:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{data.customersWithOutstandingCount}</span>
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('paymentAnalyticsTopOutstanding')}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 pr-3">{t('receiptTaskCustomer')}</th>
                <th className="pb-2 pr-3">{t('paymentBucketCount')}</th>
                <th className="pb-2">{t('paymentBucketOutstanding')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.topOutstandingCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400 dark:text-slate-500">
                    {t('paymentAnalyticsNoOutstanding')}
                  </td>
                </tr>
              ) : (
                data.topOutstandingCustomers.map((row) => (
                  <tr key={row.customerLabel} className="text-slate-700 dark:text-slate-300">
                    <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{row.customerLabel}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.receiptCount}</td>
                    <td className="py-2 font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatIls(row.outstanding)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-600">
        {t('adminAnalyticsLastUpdated')}: {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
};
