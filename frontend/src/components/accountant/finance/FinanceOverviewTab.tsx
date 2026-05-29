import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiFinanceDashboard } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { KpiCard, MiniChart, DataTable, StatusBadge, COLORS, type Column } from '../../shared/dash';

const CATEGORY_COLORS = [COLORS.indigo, COLORS.emerald, COLORS.amber, COLORS.rose, COLORS.violet, COLORS.slate];

export const FinanceOverviewTab: React.FC = () => {
  const { token, t, lang } = useApp();
  const [data, setData] = useState<ApiFinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setData(await financeCenterApi.dashboard(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>;
  if (!data) return null;

  const k = data.kpi;

  const trendLabels = data.trend.map((r) => r.month.slice(5));
  const trendSeries = [
    { label: t('fin.dashboard.trend.revenue'), values: data.trend.map((r) => r.revenue), color: COLORS.emerald },
    { label: t('fin.dashboard.trend.expenses'), values: data.trend.map((r) => r.expenses), color: COLORS.rose },
  ];

  const slices = data.byCategory.slice(0, 6).map((c, i) => ({
    label: lang === 'ar' ? (c.nameAr ?? c.nameEn ?? '—') : (c.nameEn ?? c.nameAr ?? '—'),
    value: c.total,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const txCols: Column<ApiFinanceDashboard['recent'][number]>[] = [
    { key: 'date', header: t('fin.revenue.col.date'), render: (r) => r.date ?? '—' },
    { key: 'type', header: t('fin.payments.col.type'), render: (r) => (
      <StatusBadge status={r.type} tone={r.type === 'revenue' ? 'green' : 'rose'} label={r.type === 'revenue' ? t('fin.revenue.title') : t('fin.payments.title')} />
    ) },
    { key: 'party', header: t('fin.revenue.col.party'), render: (r) => r.partyName ?? '—' },
    { key: 'amount', header: t('fin.revenue.col.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('fin.kpi.revenueToday')} value={formatIls(k.revenueToday.value)} tone="positive" delta={k.revenueToday} />
        <KpiCard label={t('fin.kpi.revenueMonth')} value={formatIls(k.revenue.value)} tone="positive" delta={k.revenue} />
        <KpiCard label={t('fin.kpi.expensesToday')} value={formatIls(k.expensesToday.value)} tone="danger" delta={k.expensesToday} />
        <KpiCard label={t('fin.kpi.expensesMonth')} value={formatIls(k.expenses.value)} tone="danger" delta={k.expenses} />

        <KpiCard label={t('fin.kpi.netToday')} value={formatIls(k.netToday.value)} tone="accent" />
        <KpiCard label={t('fin.kpi.netMonth')} value={formatIls(k.net.value)} tone="accent" delta={k.net} />
        <KpiCard label={t('fin.dashboard.kpi.receivables')} value={formatIls(k.receivables.value)} tone="warning" />
        <KpiCard label={t('fin.kpi.incompletePayments')} value={`${k.incompletePaymentCount} ${t('fin.kpi.unit.order')}`} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.dashboard.trend.title')}</h3>
          <MiniChart kind="bar" labels={trendLabels} series={trendSeries} height={200} />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.dashboard.byCategory.title')}</h3>
          {slices.length > 0 ? (
            <MiniChart kind="donut" slices={slices} height={150} />
          ) : (
            <p className="py-6 text-center text-xs text-slate-400">{t('fin.common.empty')}</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.dashboard.recent.title')}</h3>
          <DataTable rows={data.recent} columns={txCols} rowKey={(r) => r.id} empty={t('fin.common.empty')} dense />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.dashboard.alerts.title')}</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
              <span className="text-rose-800 dark:text-rose-200">{t('fin.dashboard.alerts.overdueInvoices')}</span>
              <span className="font-bold tabular-nums text-rose-900 dark:text-rose-100">{data.alerts.overdueInvoices}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
              <span className="text-amber-800 dark:text-amber-200">{t('fin.dashboard.alerts.pendingAdvances')}</span>
              <span className="font-bold tabular-nums text-amber-900 dark:text-amber-100">{data.alerts.pendingAdvances}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2 dark:bg-orange-950/30">
              <span className="text-orange-800 dark:text-orange-200">{t('fin.dashboard.alerts.debtsOver30')}</span>
              <span className="font-bold tabular-nums text-orange-900 dark:text-orange-100">{formatIls(data.alerts.debtsOver30)}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
