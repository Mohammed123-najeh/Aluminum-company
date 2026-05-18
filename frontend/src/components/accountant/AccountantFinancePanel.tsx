import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  accountantFinanceApi,
  accountantFinanceDownloads,
  clientsApi,
  ordersApi,
  type ApiAccountantAging,
  type ApiAccountantAgingBucket,
  type ApiAccountantClient,
  type ApiAccountantDebits,
  type ApiAccountantOverview,
  type ApiAccountantTrend,
  type ApiClientDetailResponse,
  type ApiOrder,
} from '../../services/api';
import { formatIls } from '../../utils/currency';
import { ClientDetailView } from '../clients/ClientDetailView';

type Section = 'dashboard' | 'aging' | 'receipts' | 'manual' | 'clients' | 'debits' | 'reports';
type Period = 'day' | 'week' | 'month' | 'year';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '—';
  }
}

function Kpi({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'positive' | 'warning' | 'accent' | 'danger';
  hint?: string;
}) {
  const toneMap = {
    neutral: 'from-slate-50 to-white text-slate-900 dark:from-slate-800 dark:to-slate-900',
    positive: 'from-emerald-50 to-white text-emerald-900 dark:from-emerald-950/40 dark:to-slate-900 dark:text-emerald-200',
    warning: 'from-amber-50 to-white text-amber-900 dark:from-amber-950/40 dark:to-slate-900 dark:text-amber-200',
    accent: 'from-indigo-50 to-white text-indigo-900 dark:from-indigo-950/40 dark:to-slate-900 dark:text-indigo-200',
    danger: 'from-rose-50 to-white text-rose-900 dark:from-rose-950/40 dark:to-slate-900 dark:text-rose-200',
  } as const;
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-linear-to-br ${toneMap[tone]} p-4 shadow-sm dark:border-slate-700`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}

function NavItem({
  active,
  onClick,
  label,
  badge,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number | string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-950/40'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>{icon}</span>
        {label}
      </span>
      {badge !== undefined && badge !== 0 && badge !== '' && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// Tiny SVG icons (no external dep)
const Icon = {
  dash: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4Zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4Zm0 8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Zm-8 2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2Z" /></svg>,
  aging: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-12a.75.75 0 0 0-1.5 0v4c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06L10.75 9.69V6Z" clipRule="evenodd" /></svg>,
  receipt: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.5 3.75A.75.75 0 0 1 3.25 3h13.5a.75.75 0 0 1 .75.75v13.06a.75.75 0 0 1-1.16.63l-1.84-1.22-1.84 1.22a.75.75 0 0 1-.82 0l-1.84-1.22-1.84 1.22a.75.75 0 0 1-.82 0l-1.84-1.22-1.84 1.22a.75.75 0 0 1-1.16-.63V3.75ZM6 7.5h8a.5.5 0 0 0 0-1H6a.5.5 0 0 0 0 1ZM6 11h8a.5.5 0 0 0 0-1H6a.5.5 0 0 0 0 1Z" clipRule="evenodd" /></svg>,
  plus: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>,
  users: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" /></svg>,
  debit: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4Zm0 4h12v6H4V8Zm2 2a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2H7a1 1 0 0 1-1-1Z" clipRule="evenodd" /></svg>,
  report: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h7.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 16.5 6.62V16.5A1.5 1.5 0 0 1 15 18H4.5A1.5 1.5 0 0 1 3 16.5V3.5ZM6 9.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5Zm.5 2.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7Z" /></svg>,
} as const;

const BUCKET_TONE: Record<ApiAccountantAgingBucket['key'], 'positive' | 'neutral' | 'warning' | 'danger'> = {
  notDue: 'positive',
  d0_30: 'neutral',
  d31_60: 'warning',
  d61_90: 'warning',
  d90_plus: 'danger',
};

export const AccountantFinancePanel: React.FC = () => {
  const { t, token } = useApp();
  const [section, setSection] = useState<Section>('dashboard');
  const [period, setPeriod] = useState<Period>('month');

  // Data
  const [overview, setOverview] = useState<ApiAccountantOverview | null>(null);
  const [trend, setTrend] = useState<ApiAccountantTrend | null>(null);
  const [aging, setAging] = useState<ApiAccountantAging | null>(null);
  const [debits, setDebits] = useState<ApiAccountantDebits | null>(null);
  const [clients, setClients] = useState<ApiAccountantClient[]>([]);
  const [receipts, setReceipts] = useState<ApiOrder[]>([]);

  // UI state
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<Record<string, string>>({});

  // Client form / detail
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ApiClientDetailResponse | null>(null);
  const [clientDetailLoading, setClientDetailLoading] = useState(false);

  // Manual receipt
  const [manualClientId, setManualClientId] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [manualPaid, setManualPaid] = useState('');
  const [manualDue, setManualDue] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualLines, setManualLines] = useState([{ description: '', quantity: '1', unitPrice: '' }]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [ov, tr, ag, de, cl, rc] = await Promise.all([
        accountantFinanceApi.overview(token),
        accountantFinanceApi.trend(token, 6),
        accountantFinanceApi.aging(token),
        accountantFinanceApi.debits(token),
        accountantFinanceApi.clients(token),
        ordersApi.list(token, { receipts_only: true }),
      ]);
      setOverview(ov);
      setTrend(tr);
      setAging(ag);
      setDebits(de);
      setClients(cl);
      setReceipts(rc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-clear transient banners after a few seconds so the panel stays clean.
  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(id);
  }, [msg]);

  const openClientDetail = useCallback(
    async (id: string) => {
      if (!token) return;
      setActiveClientId(id);
      setClientDetailLoading(true);
      setClientDetail(null);
      try {
        const d = await clientsApi.get(id, token);
        setClientDetail(d);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load client');
      } finally {
        setClientDetailLoading(false);
      }
    },
    [token],
  );

  const closeClientDetail = () => {
    setActiveClientId(null);
    setClientDetail(null);
  };

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => [c.name, c.phone ?? '', c.email ?? ''].join(' ').toLowerCase().includes(q));
  }, [clients, search]);

  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((o) =>
      [o.receiptNumber ?? '', o.clientName ?? '', o.customerReference ?? '', o.id].join(' ').toLowerCase().includes(q),
    );
  }, [receipts, search]);

  const collectionRate = useMemo(() => {
    if (!overview || overview.totals.totalBilled <= 0) return 0;
    return Math.round((overview.totals.totalPaid / overview.totals.totalBilled) * 100);
  }, [overview]);

  const trendMax = useMemo(() => {
    if (!trend) return 0;
    return trend.series.reduce((m, p) => Math.max(m, p.billed, p.collected), 0);
  }, [trend]);

  const overdueCount = overview?.overdueCount ?? 0;
  const pendingDebits = debits?.totals.pending.count ?? 0;

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !clientName.trim()) return;
    setErr(null);
    try {
      await accountantFinanceApi.createClient(token, {
        name: clientName.trim(),
        phone: clientPhone.trim() || null,
        email: clientEmail.trim() || null,
        notes: clientNotes.trim() || null,
      });
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setClientNotes('');
      setMsg('Client created.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const addPayment = async (order: ApiOrder | { id: string; balanceDue: number | null }) => {
    if (!token) return;
    const amount = Number(paymentDraft[order.id]);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setErr(null);
    try {
      await ordersApi.addPayment(order.id, token, { amount, note: 'Recorded by accountant' });
      setPaymentDraft((prev) => ({ ...prev, [order.id]: '' }));
      setMsg('Payment recorded.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const manualLineTotal = (line: { quantity: string; unitPrice: string }) => {
    const q = Number(line.quantity);
    const p = Number(line.unitPrice);
    if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p < 0) return 0;
    return q * p;
  };
  const manualGrandTotal = manualLines.reduce((s, l) => s + manualLineTotal(l), 0);

  const createManualReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !manualClientId) return;
    const items = manualLines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unit_price: Number(l.unitPrice),
      }))
      .filter((l) => l.description && Number.isFinite(l.quantity) && l.quantity > 0 && Number.isFinite(l.unit_price));
    if (items.length === 0) return;
    setErr(null);
    try {
      await accountantFinanceApi.manualReceipt(token, {
        client_id: manualClientId,
        customer_reference: manualRef.trim() || null,
        items,
        amount_paid: manualPaid.trim() === '' ? 0 : Number(manualPaid),
        payment_due_at: manualDue || null,
        payment_notes: manualNotes.trim() || null,
      });
      setManualRef('');
      setManualPaid('');
      setManualDue('');
      setManualNotes('');
      setManualLines([{ description: '', quantity: '1', unitPrice: '' }]);
      setMsg('Manual receipt created.');
      await load();
      setSection('receipts');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const onPublish = async () => {
    if (!token) return;
    setPublishing(true);
    setMsg(null);
    try {
      await accountantFinanceApi.publishReport(token, { period, note: null });
      setMsg(t('accountantPublishedOk'));
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

  if (loading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {t('requestSubmitting')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {(msg || err) && (
        <div className="mb-4 space-y-2">
          {msg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {msg}
            </div>
          )}
          {err && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {err}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 px-2 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('accountantFinanceNav')}
            </p>
          </div>
          <nav className="space-y-1">
            <NavItem active={section === 'dashboard'} onClick={() => setSection('dashboard')} label={t('accountantNavDashboard')} icon={Icon.dash} />
            <NavItem active={section === 'aging'} onClick={() => setSection('aging')} label={t('accountantNavAging')} icon={Icon.aging} badge={overdueCount || undefined} />
            <NavItem active={section === 'receipts'} onClick={() => setSection('receipts')} label={t('accountantNavReceipts')} icon={Icon.receipt} />
            <NavItem active={section === 'manual'} onClick={() => setSection('manual')} label={t('accountantNavManual')} icon={Icon.plus} />
            <NavItem active={section === 'clients'} onClick={() => { setSection('clients'); closeClientDetail(); }} label={t('accountantNavClients')} icon={Icon.users} />
            <NavItem active={section === 'debits'} onClick={() => setSection('debits')} label={t('accountantNavDebits')} icon={Icon.debit} badge={pendingDebits || undefined} />
            <NavItem active={section === 'reports'} onClick={() => setSection('reports')} label={t('accountantNavReports')} icon={Icon.report} />
          </nav>
        </aside>

        {/* Main */}
        <main className="space-y-5">
          {/* ============================================================ DASHBOARD */}
          {section === 'dashboard' && overview && (
            <>
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantDashboardTitle')}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('accountantDashboardIntro')}</p>
                </div>
              </header>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                <Kpi label={t('accountantKpiTotalSales')} value={formatIls(overview.totals.totalBilled)} tone="accent" />
                <Kpi label={t('accountantKpiTotalPaid')} value={formatIls(overview.totals.totalPaid)} tone="positive" />
                <Kpi label={t('accountantKpiOutstanding')} value={formatIls(overview.totals.totalOutstanding)} tone="warning" />
                <Kpi label={t('accountantKpiOverdue')} value={formatIls(overview.overdueOutstanding)} tone="danger" hint={`${overview.overdueCount} ${t('accountantKpiReceipts').toLowerCase()}`} />
                <Kpi label={t('accountantKpiCollectionRate')} value={`${collectionRate}%`} tone="neutral" />
                <Kpi label={t('accountantKpiReceipts')} value={overview.receiptsCount} tone="neutral" />
                <Kpi label={t('accountantKpiClients')} value={overview.clientsCount} tone="neutral" />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('accountantTrendTitle')}</h3>
                  <div className="flex gap-3 text-[11px] font-semibold uppercase tracking-wide">
                    <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                      <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
                      {t('accountantTrendBilled')}
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      {t('accountantTrendCollected')}
                    </span>
                  </div>
                </div>
                {trend && trend.series.length > 0 && trendMax > 0 ? (
                  <div className="flex h-44 items-end gap-2">
                    {trend.series.map((p) => {
                      const billedPct = trendMax > 0 ? Math.max(2, (p.billed / trendMax) * 100) : 0;
                      const collectedPct = trendMax > 0 ? Math.max(2, (p.collected / trendMax) * 100) : 0;
                      return (
                        <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-full w-full items-end justify-center gap-1">
                            <div
                              className="w-1/2 rounded-t bg-indigo-500/80 transition hover:bg-indigo-500"
                              style={{ height: `${billedPct}%` }}
                              title={`${t('accountantTrendBilled')}: ${formatIls(p.billed)}`}
                            />
                            <div
                              className="w-1/2 rounded-t bg-emerald-500/80 transition hover:bg-emerald-500"
                              style={{ height: `${collectedPct}%` }}
                              title={`${t('accountantTrendCollected')}: ${formatIls(p.collected)}`}
                            />
                          </div>
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{p.month}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">{t('accountantTrendEmpty')}</p>
                )}
              </section>

              {overview.topOutstandingCustomers.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('accountantTopDebtors')}</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {overview.topOutstandingCustomers.slice(0, 10).map((row) => (
                      <div key={row.customerLabel} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-200">{row.customerLabel}</p>
                          <p className="text-xs text-slate-500">{row.receiptCount} {t('accountantKpiReceipts').toLowerCase()}</p>
                        </div>
                        <span className="ms-3 shrink-0 font-mono tabular-nums text-amber-700 dark:text-amber-300">
                          {formatIls(row.outstanding)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ============================================================ AGING */}
          {section === 'aging' && aging && (
            <>
              <header>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantAgingTitle')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('accountantAgingIntro')}</p>
              </header>

              <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {aging.buckets.map((b) => {
                  const labelKey =
                    b.key === 'notDue'
                      ? 'accountantAgingBucketNotDue'
                      : b.key === 'd0_30'
                        ? 'accountantAgingBucket0_30'
                        : b.key === 'd31_60'
                          ? 'accountantAgingBucket31_60'
                          : b.key === 'd61_90'
                            ? 'accountantAgingBucket61_90'
                            : 'accountantAgingBucket90Plus';
                  return (
                    <Kpi
                      key={b.key}
                      label={t(labelKey as never)}
                      value={formatIls(b.outstanding)}
                      tone={BUCKET_TONE[b.key]}
                      hint={`${b.count} ${t('accountantKpiReceipts').toLowerCase()}`}
                    />
                  );
                })}
              </section>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('accountantAgingTotal')}</p>
                  <p className="font-mono text-base font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {formatIls(aging.totals.outstanding)}
                  </p>
                </div>
                {aging.totals.count === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">{t('accountantAgingEmpty')}</p>
                ) : (
                  <div className="space-y-5">
                    {aging.buckets.filter((b) => b.count > 0).map((b) => {
                      const labelKey =
                        b.key === 'notDue'
                          ? 'accountantAgingBucketNotDue'
                          : b.key === 'd0_30'
                            ? 'accountantAgingBucket0_30'
                            : b.key === 'd31_60'
                              ? 'accountantAgingBucket31_60'
                              : b.key === 'd61_90'
                                ? 'accountantAgingBucket61_90'
                                : 'accountantAgingBucket90Plus';
                      return (
                        <div key={b.key}>
                          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <span>{t(labelKey as never)} · {b.count}</span>
                            <span className="font-mono tabular-nums">{formatIls(b.outstanding)}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left text-sm">
                              <thead className="text-xs uppercase text-slate-400">
                                <tr>
                                  <th className="py-1.5 pe-3">{t('accountantAgingReceipt')}</th>
                                  <th className="py-1.5 pe-3">{t('accountantAgingClient')}</th>
                                  <th className="py-1.5 pe-3">{t('accountantAgingDue')}</th>
                                  <th className="py-1.5 pe-3 text-right">{t('accountantAgingDays')}</th>
                                  <th className="py-1.5 pe-3 text-right">{t('accountantAgingBalance')}</th>
                                  <th className="py-1.5"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.orders.map((o) => (
                                  <tr key={o.id} className="border-t border-slate-100 dark:border-slate-700">
                                    <td className="py-2 pe-3 font-mono text-xs">{o.receiptNumber ?? `#${o.id.slice(0, 8)}`}</td>
                                    <td className="py-2 pe-3">{o.clientName ?? '—'}</td>
                                    <td className="py-2 pe-3 text-xs text-slate-500">{formatDate(o.paymentDueAt)}</td>
                                    <td className="py-2 pe-3 text-right tabular-nums">{o.daysOverdue > 0 ? o.daysOverdue : '—'}</td>
                                    <td className="py-2 pe-3 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                                      {formatIls(o.balanceDue)}
                                    </td>
                                    <td className="py-2">
                                      <div className="flex items-center justify-end gap-2">
                                        <input
                                          value={paymentDraft[o.id] ?? ''}
                                          onChange={(e) => setPaymentDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                                          placeholder="₪"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-700"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void addPayment({ id: o.id, balanceDue: o.balanceDue })}
                                          className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                                        >
                                          {t('accountantAddPayment')}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ============================================================ RECEIPTS */}
          {section === 'receipts' && (
            <>
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantNavReceipts')}</h2>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('accountantSearchReceipts')}
                  className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </header>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {filteredReceipts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">—</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredReceipts.map((o) => {
                      const statusColor =
                        o.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : o.paymentStatus === 'partial'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';
                      return (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                              <span className="font-mono text-xs">{o.receiptNumber ?? `#${o.id.slice(0, 8)}`}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor}`}>
                                {o.paymentStatus}
                              </span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {o.clientName ?? o.taskCustomerName ?? o.customerReference ?? '—'}
                              {o.paymentDueAt ? ` · ${t('accountantAgingDue')}: ${formatDate(o.paymentDueAt)}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-right text-sm">
                            <div>
                              <p className="text-[10px] uppercase text-slate-400">{t('accountantReceiptTotal')}</p>
                              <p className="font-mono tabular-nums">{formatIls(o.totalAmount ?? 0)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-slate-400">{t('accountantReceiptDue')}</p>
                              <p className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                                {formatIls(o.balanceDue ?? 0)}
                              </p>
                            </div>
                            {o.paymentStatus !== 'paid' && (
                              <div className="flex items-center gap-2">
                                <input
                                  value={paymentDraft[o.id] ?? ''}
                                  onChange={(e) => setPaymentDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                                  placeholder="₪"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => void addPayment(o)}
                                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                                >
                                  {t('accountantAddPayment')}
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}

          {/* ============================================================ MANUAL RECEIPT */}
          {section === 'manual' && (
            <>
              <header>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantNavManual')}</h2>
              </header>

              <form onSubmit={createManualReceipt} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('accountantManualSelectClient')}</span>
                    <select
                      value={manualClientId}
                      onChange={(e) => setManualClientId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700"
                    >
                      <option value="">{t('accountantManualSelectClient')}</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('accountantManualReference')}</span>
                    <input value={manualRef} onChange={(e) => setManualRef(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('accountantManualAmountPaid')}</span>
                    <input value={manualPaid} onChange={(e) => setManualPaid(e.target.value)} type="number" step="0.01" min="0" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-700" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('accountantManualDueDate')}</span>
                    <input value={manualDue} onChange={(e) => setManualDue(e.target.value)} type="date" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('accountantManualNotes')}</span>
                  <textarea value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                </label>

                <div className="space-y-2">
                  <div className="grid gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid-cols-[1fr_6rem_9rem_7rem_auto]">
                    <span>{t('accountantManualLineDesc')}</span>
                    <span className="text-right">{t('accountantManualLineQty')}</span>
                    <span className="text-right">{t('accountantManualLinePrice')}</span>
                    <span className="text-right">{t('accountantManualGrandTotal')}</span>
                    <span></span>
                  </div>
                  {manualLines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 md:grid-cols-[1fr_6rem_9rem_7rem_auto]">
                      <input value={line.description} onChange={(e) => setManualLines((rows) => rows.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))} placeholder={t('accountantManualLineDesc')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                      <input value={line.quantity} onChange={(e) => setManualLines((rows) => rows.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} type="number" min="1" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-700" />
                      <input value={line.unitPrice} onChange={(e) => setManualLines((rows) => rows.map((r, i) => i === idx ? { ...r, unitPrice: e.target.value } : r))} type="number" step="0.01" min="0" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-700" />
                      <div className="flex items-center justify-end rounded-lg bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                        {formatIls(manualLineTotal(line))}
                      </div>
                      <button type="button" onClick={() => setManualLines((rows) => rows.filter((_, i) => i !== idx))} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
                        {t('accountantManualLineRemove')}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                  <button type="button" onClick={() => setManualLines((rows) => [...rows, { description: '', quantity: '1', unitPrice: '' }])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-600">
                    + {t('accountantManualAddLine')}
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-slate-400">{t('accountantManualGrandTotal')}</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatIls(manualGrandTotal)}</p>
                    </div>
                    <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                      {t('accountantManualCreate')}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

          {/* ============================================================ CLIENTS */}
          {section === 'clients' && activeClientId && (
            <ClientDetailView detail={clientDetail} loading={clientDetailLoading} showBack onBack={closeClientDetail} />
          )}

          {section === 'clients' && !activeClientId && (
            <>
              <header className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantNavClients')}</h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('accountantSearchClients')}
                  className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </header>
              <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
                <form onSubmit={createClient} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">+ Create client</h3>
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} required placeholder="Name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                  <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Phone" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                  <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                  <textarea value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} rows={2} placeholder="Notes" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700" />
                  <button className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Create</button>
                </form>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-700">
                        <tr>
                          <th className="py-2 pe-3">Client</th>
                          <th className="py-2 pe-3">Owner</th>
                          <th className="py-2 pe-3 text-right">Receipts</th>
                          <th className="py-2 pe-3 text-right">Paid</th>
                          <th className="py-2 pe-3 text-right">Balance</th>
                          <th className="py-2 pe-3">Last payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => void openClientDetail(c.id)}
                            className="cursor-pointer border-b border-slate-50 transition hover:bg-indigo-50/60 dark:border-slate-800 dark:hover:bg-indigo-950/30"
                          >
                            <td className="py-2 pe-3">
                              <p className="font-medium text-slate-800 dark:text-slate-100">{c.name}</p>
                              <p className="text-xs text-slate-500">{c.phone ?? c.email ?? '—'}</p>
                            </td>
                            <td className="py-2 pe-3 text-xs text-slate-600 dark:text-slate-300">
                              {c.supervisorName ?? (c.source === 'accountant' ? 'Accounting' : '—')}
                            </td>
                            <td className="py-2 pe-3 text-right tabular-nums">{c.orderCount}</td>
                            <td className="py-2 pe-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatIls(c.totalPaid)}</td>
                            <td className="py-2 pe-3 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-300">{formatIls(c.balanceDue)}</td>
                            <td className="py-2 pe-3 text-xs text-slate-500">{c.lastPaymentAt ? formatDate(c.lastPaymentAt) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* ============================================================ DEBITS */}
          {section === 'debits' && debits && (
            <>
              <header>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantDebitsTitle')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('accountantDebitsIntro')}</p>
              </header>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label={t('accountantDebitsPending')} value={formatIls(debits.totals.pending.amount)} hint={`${debits.totals.pending.count}`} tone="warning" />
                <Kpi label={t('accountantDebitsApproved')} value={formatIls(debits.totals.approved.amount)} hint={`${debits.totals.approved.count}`} tone="danger" />
                <Kpi label={t('accountantDebitsRejected')} value={formatIls(debits.totals.rejected.amount)} hint={`${debits.totals.rejected.count}`} tone="neutral" />
                <Kpi label={t('accountantDebitsCancelled')} value={formatIls(debits.totals.cancelled.amount)} hint={`${debits.totals.cancelled.count}`} tone="neutral" />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {debits.rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">{t('accountantDebitsEmpty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-700">
                        <tr>
                          <th className="py-2 pe-3">{t('accountantDebitsEmployee')}</th>
                          <th className="py-2 pe-3 text-right">{t('accountantDebitsAmount')}</th>
                          <th className="py-2 pe-3">{t('accountantDebitsStatus')}</th>
                          <th className="py-2 pe-3">{t('accountantDebitsReason')}</th>
                          <th className="py-2 pe-3">{t('accountantDebitsDecidedBy')}</th>
                          <th className="py-2 pe-3">{t('accountantDebitsRequestedAt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debits.rows.map((r) => {
                          const statusClass =
                            r.status === 'approved'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                              : r.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
                          return (
                            <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                              <td className="py-2 pe-3">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{r.userName ?? '—'}</p>
                                <p className="text-xs text-slate-500">{r.userEmail ?? ''}</p>
                              </td>
                              <td className="py-2 pe-3 text-right font-mono tabular-nums font-semibold">{formatIls(Number(r.amount))}</td>
                              <td className="py-2 pe-3">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass}`}>{r.status}</span>
                              </td>
                              <td className="py-2 pe-3 max-w-xs truncate text-xs text-slate-600 dark:text-slate-300">{r.reason ?? '—'}</td>
                              <td className="py-2 pe-3 text-xs text-slate-600 dark:text-slate-300">{r.decidedByName ?? '—'}</td>
                              <td className="py-2 pe-3 text-xs text-slate-500">{formatDate(r.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ============================================================ REPORTS */}
          {section === 'reports' && (
            <>
              <header>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('accountantReportsTitle')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('accountantReportsIntro')}</p>
              </header>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Period</span>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value as Period)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700"
                    >
                      <option value="day">{t('accountantPeriodDay')}</option>
                      <option value="week">{t('accountantPeriodWeek')}</option>
                      <option value="month">{t('accountantPeriodMonth')}</option>
                      <option value="year">{t('accountantPeriodYear')}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void onDownload()}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-700"
                  >
                    {t('accountantDownloadPdf')}
                  </button>
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => void onPublish()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {publishing ? t('requestSubmitting') : t('accountantPublishToAdmin')}
                  </button>
                </div>
                {overview && (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Kpi label={t('accountantKpiTotalSales')} value={formatIls(overview.totals.totalBilled)} tone="neutral" />
                    <Kpi label={t('accountantKpiTotalPaid')} value={formatIls(overview.totals.totalPaid)} tone="positive" />
                    <Kpi label={t('accountantKpiOutstanding')} value={formatIls(overview.totals.totalOutstanding)} tone="warning" />
                    <Kpi label={t('accountantKpiOverdue')} value={formatIls(overview.overdueOutstanding)} tone="danger" />
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
