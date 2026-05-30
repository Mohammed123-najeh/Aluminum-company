import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiAging, type ApiCustomerInvoice, type ApiSupplierInvoice } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, KpiCard, SectionHeader, StatusBadge, type Column } from '../../shared/dash';

type Tab = 'receivables' | 'payables';
type Bucket = 'all' | 'current_0_30' | 'd31_60' | 'd61_90' | 'd90_plus';

const BUCKET_FOR = (dueDate: string | null): Exclude<Bucket, 'all'> | null => {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysOverdue = Math.floor((today.getTime() - due) / (1000 * 60 * 60 * 24));
  if (daysOverdue <= 30) return 'current_0_30';
  if (daysOverdue <= 60) return 'd31_60';
  if (daysOverdue <= 90) return 'd61_90';
  return 'd90_plus';
};

const filterByBucket = <T extends { dueDate: string | null }>(rows: T[], bucket: Bucket): T[] =>
  bucket === 'all' ? rows : rows.filter((r) => BUCKET_FOR(r.dueDate) === bucket);

export const DebtsPanel: React.FC = () => {
  const { token, t } = useApp();
  const [tab, setTab] = useState<Tab>('receivables');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [data, setData] = useState<ApiAging | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setData(await financeCenterApi.aging(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setBucket('all'); }, [tab]);

  const receivableRowsFiltered = useMemo(
    () => filterByBucket(data?.receivables.rows ?? [], bucket),
    [data, bucket],
  );
  const payableRowsFiltered = useMemo(
    () => filterByBucket(data?.payables.rows ?? [], bucket),
    [data, bucket],
  );

  if (loading && !data) return <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>;
  if (!data) return null;

  const buckets = tab === 'receivables' ? data.receivables.buckets : data.payables.buckets;

  const receivableCols: Column<ApiCustomerInvoice>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'party', header: t('fin.debts.col.party'), render: (r) => r.clientName ?? '—' },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'due', header: t('fin.invoices.dueDate'), render: (r) => r.dueDate ?? '—' },
    { key: 'balance', header: t('fin.invoices.balance'), align: 'end', render: (r) => formatIls(Number(r.balance)) },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  const payableCols: Column<ApiSupplierInvoice>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'party', header: t('fin.debts.col.party'), render: (r) => r.supplierName ?? '—' },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'due', header: t('fin.invoices.dueDate'), render: (r) => r.dueDate ?? '—' },
    { key: 'balance', header: t('fin.invoices.balance'), align: 'end', render: (r) => formatIls(Number(r.balance)) },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  const toggleBucket = (b: Exclude<Bucket, 'all'>) => setBucket((cur) => (cur === b ? 'all' : b));

  return (
    <div className="space-y-4">
      <SectionHeader title={t('fin.debts.title')} />

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {(['receivables', 'payables'] as Tab[]).map((tt) => (
          <button
            key={tt}
            type="button"
            onClick={() => setTab(tt)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === tt
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/40'
            }`}
          >
            {t(`fin.debts.tab.${tt}` as any)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('fin.debts.bucket.current')}
          value={formatIls(buckets.current_0_30)}
          tone="positive"
          onClick={() => toggleBucket('current_0_30')}
          selected={bucket === 'current_0_30'}
        />
        <KpiCard
          label={t('fin.debts.bucket.d31_60')}
          value={formatIls(buckets.d31_60)}
          tone="warning"
          onClick={() => toggleBucket('d31_60')}
          selected={bucket === 'd31_60'}
        />
        <KpiCard
          label={t('fin.debts.bucket.d61_90')}
          value={formatIls(buckets.d61_90)}
          tone="warning"
          onClick={() => toggleBucket('d61_90')}
          selected={bucket === 'd61_90'}
        />
        <KpiCard
          label={t('fin.debts.bucket.d90_plus')}
          value={formatIls(buckets.d90_plus)}
          tone="danger"
          onClick={() => toggleBucket('d90_plus')}
          selected={bucket === 'd90_plus'}
        />
      </div>

      {bucket !== 'all' && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200">
          <span>{t('fin.debts.bucket.' + bucket as any)}</span>
          <button onClick={() => setBucket('all')} className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
            {t('fin.common.all')} ×
          </button>
        </div>
      )}

      {tab === 'receivables' ? (
        <DataTable rows={receivableRowsFiltered} columns={receivableCols} rowKey={(r) => r.id} empty={t('fin.common.empty')} />
      ) : (
        <DataTable rows={payableRowsFiltered} columns={payableCols} rowKey={(r) => r.id} empty={t('fin.common.empty')} />
      )}
    </div>
  );
};
