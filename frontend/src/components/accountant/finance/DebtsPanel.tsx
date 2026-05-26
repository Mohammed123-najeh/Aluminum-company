import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiAging, type ApiCustomerInvoice, type ApiSupplierInvoice } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, KpiCard, SectionHeader, StatusBadge, type Column } from '../../shared/dash';

type Tab = 'receivables' | 'payables';

export const DebtsPanel: React.FC = () => {
  const { token, t } = useApp();
  const [tab, setTab] = useState<Tab>('receivables');
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

  return (
    <div className="space-y-4">
      <SectionHeader title={t('fin.debts.title')} />

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {(['receivables', 'payables'] as Tab[]).map((tt) => (
          <button key={tt} type="button" onClick={() => setTab(tt)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === tt ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/40'}`}>
            {t(`fin.debts.tab.${tt}` as any)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('fin.debts.bucket.current')} value={formatIls(buckets.current_0_30)} tone="positive" />
        <KpiCard label={t('fin.debts.bucket.d31_60')} value={formatIls(buckets.d31_60)} tone="warning" />
        <KpiCard label={t('fin.debts.bucket.d61_90')} value={formatIls(buckets.d61_90)} tone="warning" />
        <KpiCard label={t('fin.debts.bucket.d90_plus')} value={formatIls(buckets.d90_plus)} tone="danger" />
      </div>

      {tab === 'receivables' ? (
        <DataTable rows={data.receivables.rows} columns={receivableCols} rowKey={(r) => r.id} empty={t('fin.common.empty')} />
      ) : (
        <DataTable rows={data.payables.rows} columns={payableCols} rowKey={(r) => r.id} empty={t('fin.common.empty')} />
      )}
    </div>
  );
};
