import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  accountantFinanceApi,
  accountantFinanceDownloads,
  type ApiAccountantCashFlow,
} from '../../services/api';
import { formatIls } from '../../utils/currency';

type Period = 'day' | 'week' | 'month' | 'year';

export const AccountantFinancePanel: React.FC = () => {
  const { t, token } = useApp();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<ApiAccountantCashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [pubMsg, setPubMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const d = await accountantFinanceApi.cashFlow(token, period);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async () => {
    if (!token) return;
    setPublishing(true);
    setPubMsg(null);
    try {
      await accountantFinanceApi.publishReport(token, { period, note: null });
      setPubMsg(t('accountantPublishedOk'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const onDownload = async () => {
    if (!token) return;
    try {
      await accountantFinanceDownloads.receiptReportPdf(token, period);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('accountantFinanceIntro')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['day', 'week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {p === 'day' && t('accountantPeriodDay')}
                {p === 'week' && t('accountantPeriodWeek')}
                {p === 'month' && t('accountantPeriodMonth')}
                {p === 'year' && t('accountantPeriodYear')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onDownload()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {t('accountantDownloadPdf')}
          </button>
          <button
            type="button"
            disabled={publishing || loading}
            onClick={() => void onPublish()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {publishing ? t('requestSubmitting') : t('accountantPublishToAdmin')}
          </button>
        </div>
      </div>

      {pubMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {pubMsg}
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">{t('requestSubmitting')}</p>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: t('adminFinancialReceipts'), v: String(data.totals.count) },
              { k: t('adminFinancialBilled'), v: formatIls(data.totals.totalBilled) },
              { k: t('adminFinancialPaid'), v: formatIls(data.totals.totalPaid) },
              { k: t('adminFinancialOutstanding'), v: formatIls(data.totals.totalOutstanding) },
            ].map((row) => (
              <div
                key={row.k}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.k}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{row.v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminPaymentStatusMix')}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              {Object.entries(data.byPaymentStatus).map(([k, v]) => (
                <li key={k}>
                  {k}: <span className="font-mono">{v}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminFinancialRiskSnapshot')}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t('adminFinancialOverdueCount')}: {data.overdueCount} — {formatIls(data.overdueOutstanding)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
              {t('adminFinancialTopDebtors')}
            </h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-2">{t('receiptTaskCustomer')}</th>
                  <th className="px-4 py-2">{t('adminFinancialReceipts')}</th>
                  <th className="px-4 py-2">{t('adminFinancialOutstanding')}</th>
                </tr>
              </thead>
              <tbody>
                {data.topOutstandingCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-slate-500">
                      {t('hrNoPending')}
                    </td>
                  </tr>
                ) : (
                  data.topOutstandingCustomers.map((row) => (
                    <tr key={row.customerLabel} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="px-4 py-2">{row.customerLabel}</td>
                      <td className="px-4 py-2 font-mono text-xs">{row.receiptCount}</td>
                      <td className="px-4 py-2">{formatIls(row.outstanding)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};
