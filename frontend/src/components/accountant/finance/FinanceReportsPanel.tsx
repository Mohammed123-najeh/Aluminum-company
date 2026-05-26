import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, KpiCard, MiniChart, SectionHeader, COLORS, type Column } from '../../shared/dash';

type ReportKey = 'pnl' | 'cashflow' | 'invoices' | 'aging' | 'advances' | 'expenseBreakdown' | 'monthlySummary';

const REPORTS: Array<{ key: ReportKey; tkey: string }> = [
  { key: 'pnl', tkey: 'fin.reports.pnl' },
  { key: 'cashflow', tkey: 'fin.reports.cashflow' },
  { key: 'invoices', tkey: 'fin.reports.invoices' },
  { key: 'aging', tkey: 'fin.reports.aging' },
  { key: 'advances', tkey: 'fin.reports.advances' },
  { key: 'expenseBreakdown', tkey: 'fin.reports.expenseBreakdown' },
  { key: 'monthlySummary', tkey: 'fin.reports.monthlySummary' },
];

const CATEGORY_COLORS = [COLORS.indigo, COLORS.emerald, COLORS.amber, COLORS.rose, COLORS.violet, COLORS.slate];

export const FinanceReportsPanel: React.FC = () => {
  const { token, t, lang } = useApp();
  const [active, setActive] = useState<ReportKey>('pnl');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (active === 'pnl' || active === 'cashflow' || active === 'monthlySummary') {
        setData(await financeCenterApi.reportPnl(token, { from, to }));
      } else if (active === 'expenseBreakdown') {
        setData(await financeCenterApi.reportExpenseBreakdown(token, { from, to }));
      } else if (active === 'aging') {
        setData(await financeCenterApi.aging(token));
      } else {
        setData(null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, active, from, to]);

  useEffect(() => { void generate(); }, [generate]);

  return (
    <div className="space-y-4">
      <SectionHeader title={t('fin.reports.title')} />

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <aside className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setActive(r.key)}
              className={`block w-full rounded-lg px-3 py-2 text-start text-sm font-medium ${
                active === r.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-950/40'
              }`}
            >
              {t(r.tkey as any)}
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label className="flex flex-col text-xs">
              <span className="text-slate-500">{t('fin.common.from')}</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <label className="flex flex-col text-xs">
              <span className="text-slate-500">{t('fin.common.to')}</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <button type="button" onClick={() => void generate()} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
              {t('fin.reports.generate')}
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {t('fin.reports.exportPdf')}
            </button>
          </div>

          {loading && <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>}

          {!loading && active === 'pnl' && data?.totals && <PnLReport data={data} t={t} />}
          {!loading && active === 'cashflow' && data?.totals && <PnLReport data={data} t={t} />}
          {!loading && active === 'monthlySummary' && data?.totals && <PnLReport data={data} t={t} />}
          {!loading && active === 'expenseBreakdown' && data?.rows && <ExpenseBreakdownReport data={data} t={t} lang={lang} />}
          {!loading && active === 'aging' && data?.receivables && <AgingReport data={data} t={t} />}
          {!loading && (active === 'invoices' || active === 'advances') && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              {t(`fin.reports.${active}` as any)} — available via list pages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PnLReport: React.FC<{ data: any; t: (k: any) => string }> = ({ data, t }) => {
  const totals = data.totals;
  const months: Array<{ month: string; type: string; total: number }> = data.byMonth ?? [];
  const monthSet = Array.from(new Set(months.map((m) => m.month))).sort();
  const revByMonth = monthSet.map((m) => months.find((x) => x.month === m && x.type === 'revenue')?.total ?? 0);
  const expByMonth = monthSet.map((m) => months.find((x) => x.month === m && x.type === 'payment')?.total ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={t('fin.dashboard.kpi.revenue')} value={formatIls(totals.revenue)} tone="positive" />
        <KpiCard label={t('fin.dashboard.kpi.expenses')} value={formatIls(totals.expenses)} tone="danger" />
        <KpiCard label={t('fin.dashboard.kpi.net')} value={formatIls(totals.net)} tone="accent" />
      </div>
      {monthSet.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">{t('fin.dashboard.trend.title')}</h3>
          <MiniChart
            kind="bar"
            labels={monthSet.map((m) => m.slice(5))}
            series={[
              { label: t('fin.dashboard.trend.revenue'), values: revByMonth, color: COLORS.emerald },
              { label: t('fin.dashboard.trend.expenses'), values: expByMonth, color: COLORS.rose },
            ]}
          />
        </div>
      )}
    </div>
  );
};

const ExpenseBreakdownReport: React.FC<{ data: any; t: (k: any) => string; lang: string }> = ({ data, t, lang }) => {
  const rows: Array<{ categoryId: string; nameAr: string | null; nameEn: string | null; total: number; count: number }> = data.rows ?? [];
  const slices = rows.slice(0, 6).map((r, i) => ({
    label: lang === 'ar' ? (r.nameAr ?? r.nameEn ?? '—') : (r.nameEn ?? r.nameAr ?? '—'),
    value: r.total,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const cols: Column<typeof rows[number]>[] = [
    { key: 'cat', header: t('fin.expenses.col.category'), render: (r) => lang === 'ar' ? r.nameAr : r.nameEn },
    { key: 'count', header: '#', align: 'end', render: (r) => r.count },
    { key: 'total', header: t('fin.invoices.total'), align: 'end', render: (r) => formatIls(r.total) },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">{t('fin.dashboard.byCategory.title')}</h3>
        {slices.length > 0 ? <MiniChart kind="donut" slices={slices} height={180} /> : <p className="py-6 text-center text-xs text-slate-400">{t('fin.common.empty')}</p>}
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.categoryId} empty={t('fin.common.empty')} />
    </div>
  );
};

const AgingReport: React.FC<{ data: any; t: (k: any) => string }> = ({ data, t }) => (
  <div className="grid gap-3 sm:grid-cols-4">
    <KpiCard label={t('fin.debts.bucket.current')} value={formatIls(data.receivables.buckets.current_0_30)} tone="positive" />
    <KpiCard label={t('fin.debts.bucket.d31_60')} value={formatIls(data.receivables.buckets.d31_60)} tone="warning" />
    <KpiCard label={t('fin.debts.bucket.d61_90')} value={formatIls(data.receivables.buckets.d61_90)} tone="warning" />
    <KpiCard label={t('fin.debts.bucket.d90_plus')} value={formatIls(data.receivables.buckets.d90_plus)} tone="danger" />
  </div>
);
