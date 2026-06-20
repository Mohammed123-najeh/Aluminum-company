import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiDebitRequest } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { StatusBadge } from '../../shared/dash';

/**
 * Advances tab — read-only list of employee salary advances. HR is the
 * approver (their queue stays canonical); Finance just observes the
 * approved ones here so they know who owes what going into payroll.
 */
export const FinanceAdvancesTab: React.FC = () => {
  const { t, token } = useApp();
  const [rows, setRows] = useState<ApiDebitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // Show only approved advances — those are the ones impacting payroll.
      // Use the finance-gated endpoint (admin/accountant) — the HR /debit-requests
      // endpoint is restricted to HR staff and returns 403 ("Forbidden") for Finance.
      const data = await financeCenterApi.advances(token, { status: 'approved' });
      data.sort((a, b) => (a.createdAt && b.createdAt ? b.createdAt.localeCompare(a.createdAt) : 0));
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.advances.heading')}</h3>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('fin.common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('fin.advances.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 text-start">{t('fin.advances.colEmployee')}</th>
                <th className="pb-2 text-end">{t('fin.advances.colAmount')}</th>
                <th className="pb-2 text-start">{t('fin.advances.colDate')}</th>
                <th className="pb-2 text-start">{t('fin.advances.colReason')}</th>
                <th className="pb-2 text-start">{t('fin.advances.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                  <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{r.userName ?? '—'}</td>
                  <td className="py-3 text-end tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                    {formatIls(Number(r.amount))}
                  </td>
                  <td className="py-3 text-xs text-slate-500">
                    {r.decidedAt ? new Date(r.decidedAt).toISOString().slice(0, 10) : new Date(r.createdAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3 max-w-md truncate" title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                  <td className="py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
