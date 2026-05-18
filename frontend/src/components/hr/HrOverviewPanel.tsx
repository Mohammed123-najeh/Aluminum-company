import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { hrAnalyticsApi, type ApiHrAnalytics } from '../../services/api';
import { formatIls } from '../../utils/currency';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export const HrOverviewPanel: React.FC = () => {
  const { token, t } = useApp();
  const [data, setData] = useState<ApiHrAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      setData(await hrAnalyticsApi.get(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <p className="text-sm text-slate-500">{t('requestSubmitting')}</p>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">HR overview for requests, workforce status, and salary advances.</p>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium dark:border-slate-600 dark:bg-slate-800">
          {t('hrRefresh')}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={t('hrAnalyticsPendingLeave')} value={data.pendingLeaveRequests} />
        <Stat label={t('hrAnalyticsPendingSalary')} value={data.pendingSalaryRequests} />
        <Stat label="Pending advances" value={data.pendingDebitRequests ?? 0} />
        <Stat label={t('hrAnalyticsActiveEmployees')} value={data.activeEmployeesCount} />
        <Stat label={t('hrAnalyticsAvgSalary')} value={data.averageBaseSalary != null ? formatIls(data.averageBaseSalary) : '-'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrAnalyticsRecentLeave')}</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {data.recentLeaveActivity.slice(0, 6).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">{row.employeeName}</span>
                <span className="text-slate-500">{row.type} - {row.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent salary advances</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {(data.recentDebitActivity ?? []).slice(0, 6).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">{row.employeeName}</span>
                <span className="text-slate-500">{formatIls(row.amount)} - {row.status}</span>
              </li>
            ))}
            {(data.recentDebitActivity ?? []).length === 0 && <li className="py-2 text-slate-500">-</li>}
          </ul>
        </section>
      </div>
    </div>
  );
};
