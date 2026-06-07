import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type {
  ApiClientDetailResponse,
  ApiClientOrder,
  ApiClientOrderItem,
  ApiClientOrderPayment,
} from '../../services/api';
import { formatIls } from '../../utils/currency';

type Props = {
  detail: ApiClientDetailResponse | null;
  loading?: boolean;
  dateFilter?: ClientDateFilter;
  /** When true, render a "Back to list" button (useful on small screens where the list collapses). */
  showBack?: boolean;
  onBack?: () => void;
};

export type ClientDateFilter =
  | { mode: 'all' }
  | { mode: 'today' }
  | { mode: 'month'; month: string }
  | { mode: 'year'; year: string }
  | { mode: 'exact'; date: string };

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '—';
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function matchesClientDateFilter(value: string | null | undefined, filter: ClientDateFilter): boolean {
  if (filter.mode === 'all') return true;
  if (!value) return false;
  let day = '';
  try {
    day = new Date(value).toISOString().slice(0, 10);
  } catch {
    return false;
  }
  if (filter.mode === 'today') {
    return day === new Date().toISOString().slice(0, 10);
  }
  if (filter.mode === 'month') {
    return filter.month ? day.startsWith(filter.month) : true;
  }
  if (filter.mode === 'year') {
    return filter.year ? day.startsWith(filter.year) : true;
  }
  if (filter.mode === 'exact') {
    return filter.date ? day === filter.date : true;
  }
  return true;
}

function clientFilterLabel(filter: ClientDateFilter, isAr: boolean): string {
  if (filter.mode === 'all') return isAr ? 'كل الفترات' : 'All time';
  if (filter.mode === 'today') return isAr ? 'اليوم' : 'Today';
  if (filter.mode === 'month') return filter.month || (isAr ? 'الشهر' : 'Month');
  if (filter.mode === 'year') return filter.year || (isAr ? 'السنة' : 'Year');
  return filter.date || (isAr ? 'تاريخ محدد' : 'Exact date');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const STATUS_COLORS: Record<ApiClientOrder['paymentStatus'], string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  unpaid: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

function ItemsTable({ items, currency }: { items: ApiClientOrderItem[]; currency: string }) {
  const { t } = useApp();
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t('clientNoItems')}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">{t('clientItemColUnit')}</th>
            <th className="px-3 py-2 text-right">{t('clientItemColQty')}</th>
            <th className="px-3 py-2 text-right">{t('clientItemColPrice')}</th>
            <th className="px-3 py-2 text-right">{t('clientItemColTotal')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {items.map((it) => (
            <tr key={it.id}>
              <td className="px-3 py-2">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {it.profileName ?? it.profileCode ?? '—'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[it.categoryName, it.colorName ?? it.colorCode].filter(Boolean).join(' · ') || '—'}
                </p>
                {it.notes && (
                  <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">“{it.notes}”</p>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                {it.quantity}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                {it.unitPrice != null ? formatIls(it.unitPrice) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                {it.lineTotal != null ? formatIls(it.lineTotal) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">{currency}</p>
    </div>
  );
}

function PaymentsList({ payments }: { payments: ApiClientOrderPayment[] }) {
  const { t } = useApp();
  if (payments.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t('clientNoPayments')}</p>;
  }
  return (
    <ol className="relative space-y-3 border-l-2 border-emerald-200 pl-4 dark:border-emerald-900/60">
      {payments.map((p) => (
        <li key={p.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-950" />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              + {formatIls(p.amount)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(p.paidAt)}</p>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {p.recordedByName ? `${t('clientPaymentColBy')}: ${p.recordedByName}` : ''}
          </p>
          {p.note && (
            <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">“{p.note}”</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function OrderCard({ order }: { order: ApiClientOrder }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);

  const statusKey = order.paymentStatus;
  const statusLabel =
    statusKey === 'paid'
      ? t('clientStatusPaid')
      : statusKey === 'partial'
        ? t('clientStatusPartial')
        : statusKey === 'unpaid'
          ? t('clientStatusUnpaid')
          : t('clientStatusUnknown');

  const orderStatusLabel =
    order.status === 'completed'
      ? t('clientOrderStatusCompleted')
      : order.status === 'draft'
        ? t('clientOrderStatusDraft')
        : order.status === 'cancelled'
          ? t('clientOrderStatusCancelled')
          : order.status;

  const orderStatusClass = ORDER_STATUS_COLORS[order.status] ?? ORDER_STATUS_COLORS.draft;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
              {order.receiptNumber ?? `#${order.id.slice(0, 8)}`}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLORS[statusKey]}`}>
              {statusLabel}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${orderStatusClass}`}>
              {orderStatusLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{formatDate(order.createdAt)}</span>
            {order.taskTitle && <span>· {order.taskTitle}</span>}
            {order.creatorName && <span>· {order.creatorName}</span>}
            {order.paymentDueAt && (
              <span>· {t('clientLastPayment')}: {formatDate(order.paymentDueAt)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('salesReceiptTotal')}
            </p>
            <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {order.totalAmount != null ? formatIls(order.totalAmount) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('clientTotalPaid')}
            </p>
            <p className="font-mono text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatIls(order.amountPaid)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('clientBalanceDue')}
            </p>
            <p className="font-mono text-base font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {order.balanceDue != null ? formatIls(order.balanceDue) : '—'}
            </p>
          </div>
        </div>
      </header>
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.25 4.25a.75.75 0 0 1 0 1.08l-4.25 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
          </svg>
          {open ? t('clientHideItems') : t('clientShowItems')}
        </button>
        {open && (
          <div className="mt-3 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('clientOrderItemsTitle')}
              </h5>
              <ItemsTable items={order.items} currency={order.currency} />
            </div>
            <div>
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('clientOrderPaymentsTitle')}
              </h5>
              <PaymentsList payments={order.payments} />
              {order.paymentNotes && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                  {order.paymentNotes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'positive' | 'warning' | 'accent';
  hint?: string;
}) {
  const toneMap: Record<typeof tone, string> = {
    neutral: 'from-slate-50 to-white text-slate-900 dark:from-slate-800 dark:to-slate-800/40 dark:text-slate-100',
    positive: 'from-emerald-50 to-white text-emerald-900 dark:from-emerald-950/40 dark:to-slate-800/40 dark:text-emerald-200',
    warning: 'from-amber-50 to-white text-amber-900 dark:from-amber-950/40 dark:to-slate-800/40 dark:text-amber-200',
    accent: 'from-indigo-50 to-white text-indigo-900 dark:from-indigo-950/40 dark:to-slate-800/40 dark:text-indigo-200',
  };
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-linear-to-br ${toneMap[tone]} p-4 shadow-sm dark:border-slate-700`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}

export const ClientDetailView: React.FC<Props> = ({ detail, loading, dateFilter = { mode: 'all' }, showBack, onBack }) => {
  const { t, lang } = useApp();
  const isAr = lang === 'ar';
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [copied, setCopied] = useState(false);

  const ordersInDateRange = useMemo(() => {
    if (!detail) return [];
    return detail.orders.filter((o) => matchesClientDateFilter(o.createdAt || o.updatedAt, dateFilter));
  }, [detail, dateFilter]);

  const tasksInDateRange = useMemo(() => {
    if (!detail?.tasks) return [];
    return detail.tasks.filter((task) => matchesClientDateFilter(task.createdAt || task.updatedAt || task.dueDate, dateFilter));
  }, [detail, dateFilter]);

  const filteredOrders = useMemo(() => {
    if (filter === 'paid') return ordersInDateRange.filter((o) => o.paymentStatus === 'paid');
    if (filter === 'unpaid')
      return ordersInDateRange.filter((o) => o.paymentStatus === 'partial' || o.paymentStatus === 'unpaid');
    return ordersInDateRange;
  }, [filter, ordersInDateRange]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        <svg className="me-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        {t('loading')}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
        <svg className="h-10 w-10 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('clientSelectHint')}</p>
      </div>
    );
  }

  const { client } = detail;

  const analytics = useMemo(() => {
    const activeOrders = ordersInDateRange.filter((o) => o.status !== 'cancelled');
    const totalPurchases = activeOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const totalPaid = activeOrders.reduce((sum, o) => sum + (o.amountPaid ?? 0), 0);
    const balanceDue = Math.max(0, totalPurchases - totalPaid);
    const unitsPurchased = activeOrders
      .flatMap((o) => o.items)
      .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const lastOrder = [...ordersInDateRange].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const payments = ordersInDateRange
      .flatMap((o) => o.payments)
      .filter((p) => matchesClientDateFilter(p.paidAt || p.createdAt, dateFilter))
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    return {
      orderCount: activeOrders.length,
      totalOrderCount: ordersInDateRange.length,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balanceDue: Math.round(balanceDue * 100) / 100,
      unitsPurchased,
      lastOrderAt: lastOrder?.updatedAt ?? null,
      lastPaymentAt: payments[0]?.paidAt ?? null,
    };
  }, [dateFilter, ordersInDateRange]);

  const handlePrint = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(client.name)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;padding:32px;color:#0f172a}
      h1{margin:0 0 4px;font-size:1.5rem}
      .meta{color:#64748b;font-size:0.9rem;margin-bottom:24px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
      .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:12px}
      .kpi p{margin:0}
      .kpi .label{font-size:0.7rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em}
      .kpi .value{font-size:1.25rem;font-weight:700;margin-top:4px}
      table{border-collapse:collapse;width:100%;margin-top:8px;margin-bottom:16px;font-size:0.9rem}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b}
      h2{font-size:1rem;margin:24px 0 4px;color:#334155}
      h3{font-size:0.95rem;margin:16px 0 4px;color:#475569}
      .right{text-align:right}
    </style></head><body>
      <h1>${escHtml(client.name)}</h1>
      <p class="meta">${escHtml([client.phone, client.email].filter(Boolean).join(' · ') || '—')}</p>
      <div class="kpis">
        <div class="kpi"><p class="label">${escHtml(t('clientOrdersCount'))}</p><p class="value">${analytics.orderCount}</p></div>
        <div class="kpi"><p class="label">${escHtml(t('clientTotalPurchases'))}</p><p class="value">${escHtml(formatIls(analytics.totalPurchases))}</p></div>
        <div class="kpi"><p class="label">${escHtml(t('clientTotalPaid'))}</p><p class="value">${escHtml(formatIls(analytics.totalPaid))}</p></div>
        <div class="kpi"><p class="label">${escHtml(t('clientBalanceDue'))}</p><p class="value">${escHtml(formatIls(analytics.balanceDue))}</p></div>
      </div>
      <h2>${escHtml(t('clientAllOrders'))}</h2>
      ${ordersInDateRange
        .map(
          (o) => `
        <h3>${escHtml(o.receiptNumber ?? '#' + o.id.slice(0, 8))} — ${escHtml(formatDate(o.createdAt))} — ${escHtml(formatIls(o.totalAmount ?? 0))} (${escHtml(o.paymentStatus)})</h3>
        <table>
          <thead><tr><th>${escHtml(t('clientItemColUnit'))}</th><th class="right">${escHtml(t('clientItemColQty'))}</th><th class="right">${escHtml(t('clientItemColPrice'))}</th><th class="right">${escHtml(t('clientItemColTotal'))}</th></tr></thead>
          <tbody>
            ${o.items
              .map(
                (i) => `<tr>
                <td>${escHtml((i.profileName ?? i.profileCode ?? '—') + (i.colorName ? ' · ' + i.colorName : ''))}</td>
                <td class="right">${i.quantity}</td>
                <td class="right">${escHtml(i.unitPrice != null ? formatIls(i.unitPrice) : '—')}</td>
                <td class="right">${escHtml(i.lineTotal != null ? formatIls(i.lineTotal) : '—')}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>`,
        )
        .join('')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  const handleCopyPhone = async () => {
    if (!client.phone) return;
    try {
      await navigator.clipboard.writeText(client.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5">
      {/* Header card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="bg-linear-to-r from-indigo-600 via-indigo-500 to-violet-500 px-6 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white ring-2 ring-white/40">
                {initials(client.name) || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">{client.name}</h2>
                <p className="mt-0.5 text-sm text-indigo-100">
                  {[client.phone, client.email].filter(Boolean).join(' · ') || '—'}
                </p>
                <p className="mt-0.5 text-xs text-indigo-200">
                  {t('clientCreatedOn')}: {formatDate(client.createdAt)}
                  {client.supervisorName ? ` · ${t('clientOwner')}: ${client.supervisorName}` : ''}
                  {client.source ? ` · ${t('clientSource')}: ${client.source}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {showBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
                >
                  ← {t('clientBackToList')}
                </button>
              )}
              {client.phone && (
                <button
                  type="button"
                  onClick={() => void handleCopyPhone()}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
                >
                  {copied ? `✓ ${t('clientCopied')}` : t('clientCopyPhone')}
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
              >
                {t('printReceipt')}
              </button>
            </div>
          </div>
        </div>
        {client.notes && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{t('clientNotes')}:</span>{' '}
            {client.notes}
          </div>
        )}
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t('clientOrdersCount')} value={analytics.orderCount} tone="accent" />
        <StatCard label={t('clientUnitsPurchased')} value={analytics.unitsPurchased} tone="neutral" />
        <StatCard
          label={t('clientTotalPurchases')}
          value={formatIls(analytics.totalPurchases)}
          tone="neutral"
        />
        <StatCard
          label={t('clientTotalPaid')}
          value={formatIls(analytics.totalPaid)}
          tone="positive"
        />
        <StatCard
          label={t('clientBalanceDue')}
          value={formatIls(analytics.balanceDue)}
          tone="warning"
        />
        <StatCard
          label={t('clientLastPayment')}
          value={formatDate(analytics.lastPaymentAt)}
          tone="neutral"
          hint={analytics.lastOrderAt ? `${t('clientLastOrder')}: ${formatDate(analytics.lastOrderAt)}` : undefined}
        />
      </section>

      {/* Orders list */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('clientAllOrders')}{' '}
              <span className="ms-1 text-sm font-normal text-slate-500">({ordersInDateRange.length})</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'الفترة' : 'Period'}: {clientFilterLabel(dateFilter, isAr)}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
            {(['all', 'paid', 'unpaid'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 transition ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {f === 'all'
                  ? t('clientFilterAll')
                  : f === 'paid'
                    ? t('clientFilterPaid')
                    : t('clientFilterUnpaid')}
              </button>
            ))}
          </div>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            {t('clientNoOrdersYet')}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>

      {/* Tasks list */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('clientTasksSectionTitle')}{' '}
            <span className="ms-1 text-sm font-normal text-slate-500">({tasksInDateRange.length})</span>
          </h3>
        </div>
        {tasksInDateRange.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            {t('clientTasksEmpty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{t('clientTasksColTitle')}</th>
                    <th className="px-4 py-2.5 text-start">{t('clientTasksColStatus')}</th>
                    <th className="px-4 py-2.5 text-start">{t('clientTasksColAssignees')}</th>
                    <th className="px-4 py-2.5 text-start">{t('clientTasksColDue')}</th>
                    <th className="px-4 py-2.5 text-end">{t('clientTasksColTotal')}</th>
                    <th className="px-4 py-2.5 text-end">{t('clientTasksColPaid')}</th>
                    <th className="px-4 py-2.5 text-end">{t('clientTasksColRemaining')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {tasksInDateRange.map((tk) => (
                    <tr key={tk.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40">
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{tk.title}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {tk.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {tk.assignees.length > 0 ? tk.assignees.map((a) => a.name).join(', ') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatDate(tk.dueDate)}</td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {tk.totalAmount !== null ? formatIls(tk.totalAmount) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatIls(tk.amountPaid)}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums text-rose-700 dark:text-rose-300">
                        {tk.balanceDue !== null ? formatIls(tk.balanceDue) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
