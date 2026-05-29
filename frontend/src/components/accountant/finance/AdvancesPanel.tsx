import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiDebitRequest } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, KpiCard, SectionHeader, StatusBadge, type Column } from '../../shared/dash';

export const AdvancesPanel: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiDebitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setRows(await financeCenterApi.advances(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const active = rows.filter((r) => r.status === 'approved');
  const pending = rows.filter((r) => r.status === 'pending');
  const totalActive = active.reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = pending.reduce((s, r) => s + Number(r.amount), 0);

  const cols: Column<ApiDebitRequest>[] = [
    { key: 'user', header: t('hr.employees.col.name'), render: (r) => r.userName ?? '—' },
    { key: 'amount', header: t('fin.revenue.col.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'reason', header: t('hr.leave.col.reason'), render: (r) => r.reason ?? '—' },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.createdAt?.slice(0, 10) ?? '—' },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title={t('fin.advances.title')} />

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={t('fin.advances.summary.active')} value={formatIls(totalActive)} tone="accent" hint={`${active.length} ${t('fin.advances.tab.employee')}`} />
        <KpiCard label={t('fin.advances.summary.pending')} value={formatIls(totalPending)} tone="warning" hint={`${pending.length}`} />
        <KpiCard label={t('fin.advances.summary.repaidMonth')} value={formatIls(0)} tone="positive" />
      </div>

      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
    </div>
  );
};
