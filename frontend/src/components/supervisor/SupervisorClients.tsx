import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiClient, ApiClientDetailResponse } from '../../services/api';
import { clientsApi } from '../../services/api';
import { formatIls } from '../../utils/currency';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const SupervisorClients: React.FC = () => {
  const { t, token } = useApp();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [list, setList] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiClientDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await clientsApi.list(token, debouncedQ || undefined);
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, debouncedQ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (id: string) => {
    if (!token) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await clientsApi.get(id, token);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load client');
    } finally {
      setDetailLoading(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const c = await clientsApi.create(
        {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          notes: formNotes.trim() || null,
        },
        token,
      );
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormNotes('');
      setList((prev) => [c, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      await openDetail(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('registerClient')}</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('clientName')}</label>
              <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('clientPhone')}</label>
              <input className={inputCls} value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('clientEmail')}</label>
              <input
                type="email"
                className={inputCls}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('clientNotes')}</label>
              <textarea className={inputCls} rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={saving || !formName.trim()}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? '…' : t('saveChanges')}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('clientsSectionTitle')}</h3>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('clientSearchPlaceholder')}
            className={inputCls + ' mb-3'}
          />
          {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && list.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('noClientsYet')}</p>
          )}
          <ul className="max-h-80 space-y-1 overflow-auto">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(c.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left text-sm transition hover:border-indigo-200 hover:bg-indigo-50/80 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/30"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span>
                  {c.phone && <span className="text-xs text-slate-500">{c.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(detailLoading || detail) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {detailLoading && <p className="text-sm text-slate-500">{t('loading')}</p>}
          {detail && !detailLoading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{detail.client.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {[detail.client.phone, detail.client.email].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {detail.client.notes && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{detail.client.notes}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">{t('clientOrdersCount')}</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {detail.analytics.orderCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">{t('clientTotalPurchases')}</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatIls(detail.analytics.totalPurchases)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">{t('clientTotalPaid')}</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatIls(detail.analytics.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">{t('clientBalanceDue')}</p>
                    <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatIls(detail.analytics.balanceDue)}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('clientOrderHistory')}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-600">
                        <th className="py-2 pr-2">{t('receiptReceiptNo')}</th>
                        <th className="py-2 pr-2">{t('receiptAmountPaid')}</th>
                        <th className="py-2 pr-2">{t('salesReceiptTotal')}</th>
                        <th className="py-2">{t('dateCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.orders.map((o) => (
                        <tr key={o.id} className="border-b border-slate-100 dark:border-slate-700">
                          <td className="py-2 pr-2 font-mono text-xs">{o.receiptNumber ?? o.id.slice(0, 8)}</td>
                          <td className="py-2 pr-2 tabular-nums">{formatIls(o.amountPaid)}</td>
                          <td className="py-2 pr-2 tabular-nums">
                            {o.totalAmount != null ? formatIls(o.totalAmount) : '—'}
                          </td>
                          <td className="py-2 text-xs text-slate-500">
                            {new Date(o.updatedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(
                    detail.client.name,
                  )}</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}h1{font-size:1.25rem}</style></head><body>
<h1>${esc(detail.client.name)}</h1>
<p>${esc([detail.client.phone, detail.client.email].filter(Boolean).join(' · ') || '—')}</p>
<h2>${esc(t('clientAnalytics'))}</h2>
<p>${esc(t('clientOrdersCount'))}: ${detail.analytics.orderCount}</p>
<p>${esc(t('clientTotalPurchases'))}: ${formatIls(detail.analytics.totalPurchases)}</p>
<p>${esc(t('clientTotalPaid'))}: ${formatIls(detail.analytics.totalPaid)}</p>
<p>${esc(t('clientBalanceDue'))}: ${formatIls(detail.analytics.balanceDue)}</p>
</body></html>`;
                  const w = window.open('', '_blank');
                  if (w) {
                    w.document.write(html);
                    w.document.close();
                    w.focus();
                    w.print();
                  }
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('printReceipt')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
