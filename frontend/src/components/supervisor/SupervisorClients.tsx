import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiClient, ApiClientDetailResponse } from '../../services/api';
import { clientsApi } from '../../services/api';
import { ClientDetailView, type ClientDateFilter } from '../clients/ClientDetailView';
import { formatIls } from '../../utils/currency';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function ClientListItem({
  client,
  active,
  onClick,
}: {
  client: ApiClient;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useApp();
  const a = client.analytics;
  const hasActivity = a && (a.orderCount > 0 || a.totalPurchases > 0 || a.balanceDue > 0);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
          active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            active
              ? 'bg-white/20 text-white ring-1 ring-white/30'
              : 'bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300'
          }`}
        >
          {initials(client.name) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-semibold ${
              active ? 'text-white' : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {client.name}
          </p>
          <p
            className={`truncate text-xs ${
              active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {client.phone ?? client.email ?? '—'}
          </p>
          {hasActivity && a && (
            <p
              className={`mt-1 flex flex-wrap gap-x-2 truncate text-[11px] font-medium tabular-nums ${
                active ? 'text-indigo-50' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span>{a.orderCount} {t('clientOrdersCount')}</span>
              <span>· {formatIls(a.totalPurchases)}</span>
              {a.balanceDue > 0 && (
                <span
                  className={
                    active
                      ? 'text-amber-100'
                      : 'text-amber-700 dark:text-amber-300'
                  }
                >
                  · {t('clientBalanceDue')}: {formatIls(a.balanceDue)}
                </span>
              )}
            </p>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 transition ${
            active ? 'text-white' : 'text-slate-300 group-hover:text-indigo-500 dark:text-slate-600'
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.25 4.25a.75.75 0 0 1 0 1.08l-4.25 4.25a.75.75 0 0 1-1.06-.02Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </li>
  );
}

export const SupervisorClients: React.FC = () => {
  const { t, token, lang } = useApp();
  const isAr = lang === 'ar';
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateMode, setDateMode] = useState<ClientDateFilter['mode']>('all');
  const [exactDate, setExactDate] = useState(today);
  const [monthValue, setMonthValue] = useState(today.slice(0, 7));
  const [yearValue, setYearValue] = useState(today.slice(0, 4));
  const [list, setList] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiClientDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
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

  const openDetail = useCallback(
    async (id: string) => {
      if (!token) return;
      setActiveId(id);
      setDetailLoading(true);
      try {
        const d = await clientsApi.get(id, token);
        setDetail(d);
        // Detail load triggers a server-side backfill of order.client_id; refresh the list so
        // newly-attributed orders show up in the sidebar totals immediately.
        clientsApi
          .list(token, debouncedQ || undefined)
          .then((data) => setList(data))
          .catch(() => {
            /* non-fatal — keep stale list */
          });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load client');
      } finally {
        setDetailLoading(false);
      }
    },
    [token, debouncedQ],
  );

  // Auto-select first client once the list loads (only on initial load, not on search).
  useEffect(() => {
    if (!activeId && !loading && list.length > 0) {
      void openDetail(list[0].id);
    }
  }, [activeId, loading, list, openDetail]);

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
      setShowForm(false);
      setList((prev) => [c, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      await openDetail(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

  const totalDue = useMemo(() => list.length, [list]);

  const dateFilter = useMemo<ClientDateFilter>(() => {
    if (dateMode === 'today') return { mode: 'today' };
    if (dateMode === 'month') return { mode: 'month', month: monthValue };
    if (dateMode === 'year') return { mode: 'year', year: yearValue };
    if (dateMode === 'exact') return { mode: 'exact', date: exactDate };
    return { mode: 'all' };
  }, [dateMode, exactDate, monthValue, yearValue]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Add-client toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('clientsSectionTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {totalDue} {t('clientsSectionTitle').toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          {t('registerClient')}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('registerClient')}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('clientName')}
              </label>
              <input
                className={inputCls}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('clientPhone')}
              </label>
              <input className={inputCls} value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('clientEmail')}
              </label>
              <input
                type="email"
                className={inputCls}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('clientNotes')}
              </label>
              <textarea
                className={inputCls}
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !formName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? '…' : t('saveChanges')}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isAr ? 'فلترة تفاصيل العميل' : 'Client detail filter'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'يؤثر الفلتر على تفاصيل العميل المحدد: الإحصائيات، الطلبات، والمهام.'
                : 'This filters the selected client detail page: stats, orders, and tasks.'}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900/40">
              {([
                ['all', isAr ? 'الكل' : 'All'],
                ['today', isAr ? 'اليوم' : 'Today'],
                ['month', isAr ? 'الشهر' : 'Month'],
                ['year', isAr ? 'السنة' : 'Year'],
                ['exact', isAr ? 'تاريخ محدد' : 'Exact date'],
              ] as Array<[ClientDateFilter['mode'], string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateMode(mode)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    dateMode === mode
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dateMode === 'month' && (
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="mb-1 block">{isAr ? 'الشهر' : 'Month'}</span>
                <input
                  type="month"
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            )}

            {dateMode === 'year' && (
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="mb-1 block">{isAr ? 'السنة' : 'Year'}</span>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={yearValue}
                  onChange={(e) => setYearValue(e.target.value.slice(0, 4))}
                  className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            )}

            {dateMode === 'exact' && (
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="mb-1 block">{isAr ? 'التاريخ' : 'Date'}</span>
                <input
                  type="date"
                  value={exactDate}
                  onChange={(e) => setExactDate(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Master-detail layout */}
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="relative mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('clientSearchPlaceholder')}
              className={`${inputCls} ps-9`}
            />
          </div>
          {loading && (
            <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">{t('loading')}</p>
          )}
          {!loading && list.length === 0 && (
            <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">{t('noClientsYet')}</p>
          )}
          <ul className="max-h-128 space-y-1 overflow-auto pe-1">
            {list.map((c) => (
              <ClientListItem
                key={c.id}
                client={c}
                active={c.id === activeId}
                onClick={() => void openDetail(c.id)}
              />
            ))}
          </ul>
        </aside>

        <section>
          <ClientDetailView detail={detail} loading={detailLoading} dateFilter={dateFilter} />
        </section>
      </div>
    </div>
  );
};
